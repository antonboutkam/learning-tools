<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/certificates/service.php';
if (PHP_SAPI !== 'cli' || $argc < 3 || $argc > 4) { fwrite(STDERR, "Gebruik: php scripts/certificate-verify.php certificaat.json public-keys.json [verwachting.json]\n"); exit(1); }
try {
    $payload = lt_verify(lt_read_json($argv[1]), lt_read_json($argv[2]));
    $expected = isset($argv[3]) ? lt_read_json($argv[3]) : [];
    $reasons = [];
    foreach (['groupId', 'revision', 'studentName', 'studentClass'] as $field) {
        if (isset($expected[$field]) && $expected[$field] !== ($payload[$field] ?? null)) $reasons[] = "$field komt niet overeen";
    }
    if (isset($expected['requiredToolIds'])) {
        $actual = array_column($payload['results'], 'id'); $wanted = $expected['requiredToolIds']; sort($actual); sort($wanted);
        if ($actual !== $wanted) $reasons[] = 'Opdrachtenlijst komt niet overeen';
    }
    foreach ($payload['results'] as $result) if (($result['completed'] ?? false) !== true) $reasons[] = 'Onvoltooide opdracht';
    $contextChecked = isset($expected['groupId'], $expected['revision'], $expected['requiredToolIds'], $expected['studentName'], $expected['studentClass']);
    if (!$contextChecked) $reasons[] = 'Niet alle opdracht- en inzendergegevens opgegeven voor vergelijking';
    $status = $reasons ? 'handmatig_controleren' : 'voldaan';
    echo lt_json(['status' => $status, 'signatureValid' => true, 'reasons' => $reasons, 'certificate' => $payload]) . "\n";
    exit($reasons ? 2 : 0);
} catch (Throwable $e) { echo lt_json(['status' => 'ongeldig', 'signatureValid' => false, 'reason' => $e->getMessage()]) . "\n"; exit(1); }
