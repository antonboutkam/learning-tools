<?php
declare(strict_types=1);
require dirname(__DIR__, 4) . '/lib/certificates/service.php';
umask(0077);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); header('Allow: POST'); throw new InvalidArgumentException('Gebruik POST.'); }
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') throw new InvalidArgumentException('Gebruik application/json.');
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if ($raw === false || strlen($raw) > 65536) throw new InvalidArgumentException('Verzoek is te groot.');
    $request = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($request)) throw new InvalidArgumentException('Ongeldig verzoek.');
    $configPath = getenv('LT_CERTIFICATE_CONFIG') ?: dirname(__DIR__, 4) . '/.private/opdrachtcertificaat/config.json';
    if (!$configPath) throw new RuntimeException('Certificaatdienst is nog niet ingericht.');
    $settings = lt_read_json($configPath);
    if (($request['action'] ?? '') === 'manifest') {
        echo lt_json(lt_manifest($settings, $request['groupId'] ?? null, $request['revision'] ?? null));
    } elseif (($request['action'] ?? '') === 'issue') {
        echo lt_json(lt_issue($settings, $request));
    } else throw new InvalidArgumentException('Onbekende actie.');
} catch (DomainException $e) {
    http_response_code(409); echo lt_json(['error' => $e->getMessage()]);
} catch (InvalidArgumentException | JsonException $e) {
    if (http_response_code() !== 405) http_response_code(400);
    echo lt_json(['error' => $e instanceof JsonException ? 'Ongeldige JSON.' : $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(503); echo lt_json(['error' => 'De certificaatdienst is niet beschikbaar. Je voortgang blijft in dit venster bewaard. Probeer later opnieuw.']);
}
