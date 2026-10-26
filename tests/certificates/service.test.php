<?php
declare(strict_types=1);
require dirname(__DIR__, 2) . '/lib/certificates/service.php';
umask(0077);
$dir = sys_get_temp_dir() . '/lt-certificate-test-' . bin2hex(random_bytes(6));
mkdir($dir, 0700); mkdir($dir . '/records', 0700); mkdir($dir . '/manifests', 0700);
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function rejects(callable $fn, string $message): void { try { $fn(); } catch (InvalidArgumentException | DomainException $e) { return; } throw new RuntimeException($message); }
try {
    $pair = sodium_crypto_sign_keypair();
    file_put_contents($dir . '/key', base64_encode(sodium_crypto_sign_secretkey($pair)));
    $keys = ['test-key' => base64_encode(sodium_crypto_sign_publickey($pair))];
    $settings = ['keyId' => 'test-key', 'secretKeyFile' => $dir . '/key', 'recordDir' => $dir . '/records', 'manifestDir' => $dir . '/manifests'];
    $manifest = ['groupId' => 'lesson', 'revision' => '1', 'title' => 'Mijn les', 'requiredTools' => [['id' => 'a', 'title' => 'Eerste'], ['id' => 'b', 'title' => 'Tweede']]];
    file_put_contents($dir . '/manifests/lesson--1.json', lt_json($manifest));
    $request = ['groupId' => 'lesson', 'revision' => '1', 'attemptId' => '12345678-1234-4234-8234-123456789012', 'studentName' => 'Zoë Test', 'studentClass' => 'SD4', 'results' => [['id' => 'a', 'completed' => true, 'completedAt' => '2026-10-25T10:00:00.000Z', 'score' => ['correct' => 3, 'total' => 4]], ['id' => 'b', 'completed' => true, 'completedAt' => '2026-10-25T10:01:00.000Z', 'score' => ['value' => -120]]]];
    $missing = $request; array_pop($missing['results']); rejects(fn() => lt_issue($settings, $missing), 'Missing result accepted');
    $false = $request; $false['results'][0]['completed'] = false; rejects(fn() => lt_issue($settings, $false), 'Incomplete result accepted');
    $duplicate = $request; $duplicate['results'][1] = $duplicate['results'][0]; rejects(fn() => lt_issue($settings, $duplicate), 'Duplicate result accepted');
    $foreign = $request; $foreign['results'][1]['id'] = 'c'; rejects(fn() => lt_issue($settings, $foreign), 'Foreign result accepted');
    $traversal = $request; $traversal['groupId'] = '../lesson'; rejects(fn() => lt_issue($settings, $traversal), 'Traversal accepted');
    $envelope = lt_issue($settings, $request); $payload = lt_verify($envelope, $keys);
    check($payload['studentName'] === 'Zoë Test', 'Unicode lost');
    check($payload['results'][1]['score']['value'] === -120, 'Raw score lost');
    check(lt_issue($settings, $request) === $envelope, 'Retry issued new certificate');
    $renamed = $request; $renamed['studentName'] = 'Other'; rejects(fn() => lt_issue($settings, $renamed), 'Name changed on issued attempt');
    $reclassed = $request; $reclassed['studentClass'] = 'Other'; rejects(fn() => lt_issue($settings, $reclassed), 'Class changed on issued attempt');
    $tampered = $envelope; $p = $payload; $p['studentName'] = 'Other'; $tampered['payload'] = base64_encode(lt_json($p)); rejects(fn() => lt_verify($tampered, $keys), 'Tampering accepted');
    $tampered = $envelope; $tampered['keyId'] = 'other'; rejects(fn() => lt_verify($tampered, $keys), 'Wrong key accepted');
    $tampered = $envelope; $tampered['format'] = 'other'; rejects(fn() => lt_verify($tampered, $keys), 'Wrong format accepted');
    $tampered = $envelope; $tampered['signature'] = 'broken'; rejects(fn() => lt_verify($tampered, $keys), 'Bad signature accepted');
    check(lt_verify(json_decode(json_encode(array_reverse($envelope, true), JSON_PRETTY_PRINT), true), $keys) === $payload, 'Envelope formatting broke verification');
    echo "PASS: signing, Unicode, raw scores, idempotence, identity lock, required results, tampering, keys, format and JSON formatting\n";
} finally {
    foreach (glob($dir . '/records/*') as $file) unlink($file);
    foreach (glob($dir . '/manifests/*') as $file) unlink($file);
    unlink($dir . '/key'); rmdir($dir . '/records'); rmdir($dir . '/manifests'); rmdir($dir);
}
