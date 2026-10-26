<?php
declare(strict_types=1);

const LT_CERT_FORMAT = 'learning-tools-certificate-v1';

function lt_json(mixed $value): string {
    return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}
function lt_read_json(string $path): array {
    $raw = @file_get_contents($path);
    if ($raw === false) throw new RuntimeException('Certificaatdienst is niet ingericht.');
    $value = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($value)) throw new RuntimeException('Ongeldige serverconfiguratie.');
    return $value;
}
function lt_text(mixed $value, int $max = 160): string {
    if (!is_string($value) || !preg_match('//u', $value)) throw new InvalidArgumentException('Ongeldig tekstveld.');
    $value = trim($value);
    if ($value === '' || strlen($value) > $max || preg_match('/[\x00-\x1f\x7f]/u', $value)) throw new InvalidArgumentException('Tekstveld is leeg of ongeldig.');
    return $value;
}
function lt_id(mixed $value): string {
    if (!is_string($value) || !preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\z/', $value)) throw new InvalidArgumentException('Ongeldige identificatie.');
    return $value;
}
function lt_manifest(array $settings, mixed $groupId, mixed $revision): array {
    $groupId = lt_id($groupId); $revision = lt_id($revision);
    $manifest = lt_read_json($settings['manifestDir'] . '/' . $groupId . '--' . $revision . '.json');
    if (($manifest['groupId'] ?? null) !== $groupId || ($manifest['revision'] ?? null) !== $revision) throw new RuntimeException('Manifest komt niet overeen.');
    lt_text($manifest['title'] ?? null);
    $tools = $manifest['requiredTools'] ?? null;
    if (!is_array($tools) || !array_is_list($tools) || count($tools) < 1 || count($tools) > 100) throw new RuntimeException('Ongeldige opdrachtenlijst.');
    $ids = [];
    foreach ($tools as $tool) {
        $id = lt_id($tool['id'] ?? null); lt_text($tool['title'] ?? null);
        if (isset($ids[$id])) throw new RuntimeException('Dubbele opdracht-ID.');
        $ids[$id] = true;
    }
    return $manifest;
}
function lt_score(mixed $score): ?array {
    if ($score === null) return null;
    if (!is_array($score)) throw new InvalidArgumentException('Ongeldige score.');
    $number = static fn($v) => (is_int($v) || is_float($v)) && is_finite((float)$v) && abs($v) <= 1e9;
    if (isset($score['value']) && $number($score['value'])) return ['value' => $score['value']];
    if ($number($score['correct'] ?? null) && $number($score['total'] ?? null) && $score['correct'] >= 0 && $score['total'] > 0 && $score['correct'] <= $score['total']) return ['correct' => $score['correct'], 'total' => $score['total']];
    throw new InvalidArgumentException('Ongeldige score.');
}
function lt_issue(array $settings, array $request): array {
    $manifest = lt_manifest($settings, $request['groupId'] ?? null, $request['revision'] ?? null);
    $attempt = $request['attemptId'] ?? '';
    if (!is_string($attempt) || !preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i', $attempt)) throw new InvalidArgumentException('Ongeldige poging-ID.');
    $name = lt_text($request['studentName'] ?? null); $class = lt_text($request['studentClass'] ?? null, 80);
    $dir = $settings['recordDir'];
    if (!is_dir($dir) || !is_writable($dir)) throw new RuntimeException('Certificaatopslag is niet beschikbaar.');
    $key = hash('sha256', $manifest['groupId'] . "\0" . $manifest['revision'] . "\0" . strtolower($attempt));
    $path = $dir . '/' . $key . '.json';
    $lock = fopen($dir . '/' . $key . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Certificaatopslag is bezet.');
    try {
        if (is_file($path)) {
            $envelope = lt_read_json($path);
            $payload = json_decode(base64_decode($envelope['payload'], true), true, 64, JSON_THROW_ON_ERROR);
            if ($payload['studentName'] !== $name || $payload['studentClass'] !== $class) throw new DomainException('Deze poging heeft al een certificaat op een andere naam of klas. Download het oorspronkelijke certificaat.');
            return $envelope;
        }
        $results = $request['results'] ?? null;
        if (!is_array($results) || !array_is_list($results) || count($results) !== count($manifest['requiredTools'])) throw new InvalidArgumentException('Niet alle opdrachten zijn afgerond.');
        $byId = [];
        foreach ($results as $row) {
            if (!is_array($row)) throw new InvalidArgumentException('Ongeldig resultaat.');
            $id = lt_id($row['id'] ?? null);
            if (isset($byId[$id]) || ($row['completed'] ?? false) !== true) throw new InvalidArgumentException('Dubbel of onvoltooid resultaat.');
            $byId[$id] = $row;
        }
        $accepted = [];
        foreach ($manifest['requiredTools'] as $tool) {
            $row = $byId[$tool['id']] ?? null;
            if (!$row) throw new InvalidArgumentException('Een vereiste opdracht ontbreekt.');
            $time = lt_text($row['completedAt'] ?? null, 40);
            if (!preg_match('/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z\z/', $time) || strtotime($time) === false) throw new InvalidArgumentException('Ongeldig afrondmoment.');
            $accepted[] = ['id' => $tool['id'], 'title' => $tool['title'], 'completed' => true, 'score' => lt_score($row['score'] ?? null), 'clientCompletedAt' => $time];
        }
        $payload = ['format' => LT_CERT_FORMAT, 'certificateId' => bin2hex(random_bytes(16)), 'attemptId' => strtolower($attempt), 'studentName' => $name, 'studentClass' => $class, 'groupId' => $manifest['groupId'], 'revision' => $manifest['revision'], 'title' => $manifest['title'], 'issuedAt' => gmdate('Y-m-d\TH:i:s\Z'), 'assessment' => 'formative-client-reported', 'results' => $accepted];
        $bytes = lt_json($payload);
        $secret = base64_decode(trim((string)@file_get_contents($settings['secretKeyFile'])), true);
        if ($secret === false || strlen($secret) !== SODIUM_CRYPTO_SIGN_SECRETKEYBYTES) throw new RuntimeException('Ondertekeningssleutel ontbreekt.');
        // Domain separation authenticates the format and key identifier as well.
        $keyId = lt_id($settings['keyId']);
        $signature = sodium_crypto_sign_detached(LT_CERT_FORMAT . "\n" . $keyId . "\n" . $bytes, $secret);
        sodium_memzero($secret);
        $envelope = ['format' => LT_CERT_FORMAT, 'keyId' => $keyId, 'payload' => base64_encode($bytes), 'signature' => base64_encode($signature)];
        $tmp = tempnam($dir, '.certificate-');
        if ($tmp === false) throw new RuntimeException('Certificaat kon niet worden opgeslagen.');
        try {
            if (file_put_contents($tmp, lt_json($envelope) . "\n") === false || !rename($tmp, $path)) throw new RuntimeException('Certificaat kon niet worden opgeslagen.');
        } finally { if (is_file($tmp)) unlink($tmp); }
        return $envelope;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
function lt_verify(array $envelope, array $publicKeys): array {
    if (($envelope['format'] ?? null) !== LT_CERT_FORMAT) throw new InvalidArgumentException('Onbekend certificaatformaat.');
    $keyId = lt_id($envelope['keyId'] ?? null);
    $key = base64_decode($publicKeys[$keyId] ?? '', true);
    $bytes = is_string($envelope['payload'] ?? null) ? base64_decode($envelope['payload'], true) : false;
    $signature = is_string($envelope['signature'] ?? null) ? base64_decode($envelope['signature'], true) : false;
    if ($key === false || strlen($key) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES || $bytes === false || $signature === false || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES || !sodium_crypto_sign_verify_detached($signature, LT_CERT_FORMAT . "\n" . $keyId . "\n" . $bytes, $key)) throw new InvalidArgumentException('Handtekening is ongeldig of sleutel is onbekend.');
    $payload = json_decode($bytes, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($payload) || ($payload['format'] ?? null) !== LT_CERT_FORMAT || !isset($payload['studentName'], $payload['studentClass'], $payload['groupId'], $payload['revision'], $payload['certificateId'], $payload['issuedAt'], $payload['results'])) throw new InvalidArgumentException('Certificaatgegevens ontbreken.');
    return $payload;
}
