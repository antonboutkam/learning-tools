<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

final class ApiError extends RuntimeException { public function __construct(string $message, public int $status = 400) { parent::__construct($message); } }
function out(array $data, int $status = 200): never { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail(Throwable $error): never { out(['error' => $error->getMessage()], $error instanceof ApiError ? $error->status : 500); }
function input(): array { $data = json_decode((string)file_get_contents('php://input'), true); return is_array($data) ? $data : []; }
function now(): int { return (int)round(microtime(true) * 1000); }
function storage(): string {
    static $path = null;
    if ($path !== null) return $path;
    $candidate = trim((string)getenv('LEARNING_TOOLS_POLL_VOTE_STORAGE')) ?: rtrim(sys_get_temp_dir(), '/\\') . '/learning-tools-poll-vote';
    if ((!is_dir($candidate) && !@mkdir($candidate, 0700, true)) || !is_writable($candidate)) throw new ApiError('Kan geen schrijfbare sessie-opslag buiten de document root gebruiken.', 500);
    return $path = rtrim($candidate, '/\\');
}
function sessionCode(string $uniqueId): string { return substr(hash('sha256', $uniqueId), 0, 24); }
function readSession(string $code): ?array { $file = storage() . '/' . $code . '.json'; $data = is_file($file) ? json_decode((string)file_get_contents($file), true) : null; return is_array($data) ? $data : null; }
function saveSession(array $session): void { file_put_contents(storage() . '/' . $session['code'] . '.json', json_encode($session, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL, LOCK_EX); }
function locked(string $code, callable $callback): array {
    $lock = fopen(storage() . '/' . $code . '.lock', 'c+');
    if (!$lock) throw new ApiError('De poll kan niet worden vergrendeld.', 500);
    flock($lock, LOCK_EX);
    try { $session = $callback(readSession($code)); saveSession($session); return $session; }
    finally { flock($lock, LOCK_UN); fclose($lock); }
}
function text(mixed $value, int $limit): string { return mb_substr(trim((string)$value), 0, $limit); }
function config(array $raw): array {
    $title = text($raw['titel'] ?? '', 120);
    if ($title === '') throw new ApiError('De poll heeft een titel nodig.');
    $questions = [];
    foreach (($raw['vragen'] ?? []) as $rawQuestion) {
        if (!is_array($rawQuestion)) continue;
        $question = text($rawQuestion['vraag'] ?? '', 500); $answers = [];
        foreach (($rawQuestion['antwoorden'] ?? []) as $rawAnswer) {
            if (!is_array($rawAnswer)) continue;
            $long = text($rawAnswer['lang'] ?? '', 300); $short = text($rawAnswer['kort'] ?? '', 80);
            if ($long !== '' && $short !== '') $answers[] = ['long' => $long, 'short' => $short];
        }
        if ($question !== '' && count($answers) >= 2) $questions[] = ['question' => $question, 'answers' => array_slice($answers, 0, 12)];
    }
    if (!$questions) throw new ApiError('Voeg minimaal één vraag met twee antwoorden toe.');
    return ['titel' => $title, 'vragen' => array_slice($questions, 0, 30)];
}
function teacher(array $session, string $token): void { if ($token === '' || !hash_equals((string)$session['teacherToken'], $token)) throw new ApiError('Alleen de docent kan dit doen.', 403); }
function participant(array &$session, string $token): ?int { foreach ($session['participants'] as $index => $person) if ($token !== '' && hash_equals($person['token'], $token)) return $index; return null; }
function response(array $session, string $participantToken = '', bool $isTeacher = false): array {
    $answers = $session['config']['vragen'][$session['questionIndex']]['answers'];
    $counts = array_fill(0, count($answers), 0); $voters = []; $myVotes = [];
    foreach ($session['votes'] as $participantId => $votes) foreach ($votes as $questionIndex => $answerIndex) {
        if (isset($session['config']['vragen'][$questionIndex]['answers'][$answerIndex])) {
            if ($questionIndex === $session['questionIndex']) $counts[$answerIndex]++;
            $myVotes[$questionIndex] = $answerIndex;
        }
    }
    $participantIndex = participant($session, $participantToken);
    $myVotes = $participantIndex === null ? [] : ($session['votes'][$session['participants'][$participantIndex]['id']] ?? []);
    foreach ($session['participants'] as $person) {
        $answerIndex = $session['votes'][$person['id']][$session['questionIndex']] ?? null;
        if ($isTeacher && $answerIndex !== null) $voters[] = ['id' => $person['id'], 'name' => $person['name'], 'answerIndex' => $answerIndex];
    }
    $questions = [];
    foreach ($session['config']['vragen'] as $index => $question) $questions[] = ['question' => $question['question'], 'answers' => array_map(fn($answer, $answerIndex) => ['long' => $answer['long'], 'short' => $answer['short'], 'count' => $index === $session['questionIndex'] ? $counts[$answerIndex] : 0], $question['answers'], array_keys($question['answers']))];
    return ['config' => ['titel' => $session['config']['titel']], 'questionIndex' => $session['questionIndex'], 'questions' => $questions, 'totalVotes' => array_sum($counts), 'me' => $participantIndex === null ? null : ['name' => $session['participants'][$participantIndex]['name']], 'myVotes' => $myVotes, 'voters' => $voters, 'updatedAt' => $session['updatedAt']];
}

try {
    $uniqueId = text($_GET['unique_id'] ?? '', 200); if ($uniqueId === '') throw new ApiError('unique_id ontbreekt.');
    $code = sessionCode($uniqueId); $action = (string)($_GET['action'] ?? 'state'); $data = input(); $teacherActions = ['previous', 'next', 'select_question', 'clear_question', 'clear_all', 'set_vote', 'delete_vote'];
    if ($action === 'state') { $session = readSession($code); if (!$session) throw new ApiError('Open eerst de docentweergave om de poll te starten.', 404); out(response($session, (string)($_GET['participantToken'] ?? ''))); }
    $session = locked($code, function (?array $session) use ($action, $data, $code, $teacherActions): array {
        if ($action === 'init') {
            $newConfig = config(is_array($data['config'] ?? null) ? $data['config'] : []);
            if (!$session || ($session['configHash'] ?? '') !== hash('sha256', json_encode($newConfig))) return ['code' => $code, 'config' => $newConfig, 'configHash' => hash('sha256', json_encode($newConfig)), 'questionIndex' => 0, 'teacherToken' => '', 'participants' => [], 'votes' => [], 'updatedAt' => now()];
            return $session;
        }
        if (!$session) throw new ApiError('Open eerst de docentweergave om de poll te starten.', 404);
        if ($action === 'claim_teacher') { $given = (string)($data['teacherToken'] ?? ''); if ($session['teacherToken'] !== '' && !hash_equals($session['teacherToken'], $given)) throw new ApiError('Deze poll wordt al bediend door een andere docentweergave.', 409); if ($session['teacherToken'] === '') $session['teacherToken'] = bin2hex(random_bytes(20)); return $session; }
        if ($action === 'join') { $name = text($data['name'] ?? '', 60); $token = text($data['participantToken'] ?? '', 120); if ($name === '' || $token === '') throw new ApiError('Vul je naam in.'); $index = participant($session, $token); if ($index === null) $session['participants'][] = ['id' => bin2hex(random_bytes(10)), 'name' => $name, 'token' => $token]; else $session['participants'][$index]['name'] = $name; $session['updatedAt'] = now(); return $session; }
        if ($action === 'vote') { $index = participant($session, (string)($data['participantToken'] ?? '')); $answer = (int)($data['answerIndex'] ?? -1); if ($index === null) throw new ApiError('Meld je eerst aan om te stemmen.', 403); if (!isset($session['config']['vragen'][$session['questionIndex']]['answers'][$answer])) throw new ApiError('Dit antwoord bestaat niet.'); $id = $session['participants'][$index]['id']; if (isset($session['votes'][$id][$session['questionIndex']])) throw new ApiError('Je hebt al gestemd voor deze vraag.', 409); $session['votes'][$id][$session['questionIndex']] = $answer; $session['updatedAt'] = now(); return $session; }
        if (in_array($action, $teacherActions, true)) {
            teacher($session, (string)($data['teacherToken'] ?? '')); $questionCount = count($session['config']['vragen']);
            if ($action === 'previous') $session['questionIndex'] = max(0, $session['questionIndex'] - 1);
            if ($action === 'next') $session['questionIndex'] = min($questionCount - 1, $session['questionIndex'] + 1);
            if ($action === 'select_question') { $index = (int)($data['questionIndex'] ?? -1); if (!isset($session['config']['vragen'][$index])) throw new ApiError('Deze vraag bestaat niet.'); $session['questionIndex'] = $index; }
            if ($action === 'clear_question') foreach ($session['votes'] as &$votes) unset($votes[$session['questionIndex']]);
            if ($action === 'clear_all') $session['votes'] = [];
            if ($action === 'set_vote' || $action === 'delete_vote') { $id = text($data['participantId'] ?? '', 60); $known = false; foreach ($session['participants'] as $person) if (hash_equals($person['id'], $id)) $known = true; if (!$known) throw new ApiError('De deelnemer bestaat niet.'); if ($action === 'set_vote') { $answer = (int)($data['answerIndex'] ?? -1); if (!isset($session['config']['vragen'][$session['questionIndex']]['answers'][$answer])) throw new ApiError('Dit antwoord bestaat niet.'); $session['votes'][$id][$session['questionIndex']] = $answer; } else unset($session['votes'][$id][$session['questionIndex']]); }
            $session['updatedAt'] = now(); return $session;
        }
        throw new ApiError('Onbekende actie.');
    });
    $isTeacher = in_array($action, $teacherActions, true) || $action === 'claim_teacher' || $action === 'init';
    $result = response($session, (string)($data['participantToken'] ?? ''), $isTeacher); if ($action === 'claim_teacher') $result['teacherToken'] = $session['teacherToken']; out($result);
} catch (Throwable $error) { fail($error); }
