<?php
declare(strict_types=1);

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * @return array<string, string>
 */
function collect_params(): array
{
    $merged = [];
    foreach ([$_GET, $_POST] as $source) {
        foreach ($source as $key => $value) {
            if (!is_string($key) || $key === '') {
                continue;
            }
            if (is_scalar($value)) {
                $merged[$key] = trim((string)$value);
            }
        }
    }

    return $merged;
}

function is_sensitive_key(string $key): bool
{
    return (bool)preg_match('/(token|secret|signature|password|id_token|jwt|oauth_)/i', $key);
}

function mask_value(string $value): string
{
    $length = strlen($value);
    if ($length <= 8) {
        return str_repeat('*', $length);
    }

    return substr($value, 0, 4) . str_repeat('*', max(2, $length - 8)) . substr($value, -4);
}

/**
 * @return array{status:int,headers:string,body:string,error:string}
 */
function send_debug_request(string $targetUrl, string $contentType, string $body, string $authHeader): array
{
    $status = 0;
    $headersRaw = '';
    $bodyRaw = '';
    $error = '';

    if (!preg_match('#^https?://#i', $targetUrl)) {
        return [
            'status' => 0,
            'headers' => '',
            'body' => '',
            'error' => 'Alleen http(s) URLs zijn toegestaan.',
        ];
    }

    if (function_exists('curl_init')) {
        $headers = ['Content-Type: ' . $contentType];
        if ($authHeader !== '') {
            $headers[] = 'Authorization: ' . $authHeader;
        }

        $responseHeaders = '';

        $ch = curl_init($targetUrl);
        curl_setopt_array(
            $ch,
            [
                CURLOPT_CUSTOMREQUEST => 'POST',
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HEADER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 12,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
            ]
        );

        $response = curl_exec($ch);
        if ($response === false) {
            $error = 'cURL fout: ' . (string)curl_error($ch);
        } else {
            $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $responseHeaders = substr($response, 0, $headerSize);
            $bodyRaw = substr($response, $headerSize);
            $headersRaw = trim($responseHeaders);
        }

        curl_close($ch);

        return [
            'status' => $status,
            'headers' => $headersRaw,
            'body' => $bodyRaw,
            'error' => $error,
        ];
    }

    $headers = 'Content-Type: ' . $contentType;
    if ($authHeader !== '') {
        $headers .= "\r\nAuthorization: " . $authHeader;
    }

    $context = stream_context_create(
        [
            'http' => [
                'method' => 'POST',
                'header' => $headers,
                'content' => $body,
                'timeout' => 12,
                'ignore_errors' => true,
            ],
        ]
    );

    $response = @file_get_contents($targetUrl, false, $context);
    if ($response === false) {
        return [
            'status' => 0,
            'headers' => '',
            'body' => '',
            'error' => 'Request mislukt (geen cURL en file_get_contents gaf false).',
        ];
    }

    $bodyRaw = $response;
    $responseHeaders = isset($http_response_header) && is_array($http_response_header)
        ? $http_response_header
        : [];
    $headersRaw = implode("\n", $responseHeaders);

    foreach ($responseHeaders as $line) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
            $status = (int)$m[1];
            break;
        }
    }

    return [
        'status' => $status,
        'headers' => $headersRaw,
        'body' => $bodyRaw,
        'error' => '',
    ];
}

$params = collect_params();
$defaultTarget = (string)($params['lis_outcome_service_url'] ?? '');
$defaultBody = "{\n  \"tool\": \"learning-tools-lti-debug\",\n  \"timestamp\": \"" . gmdate('c') . "\",\n  \"scoreGiven\": 1,\n  \"scoreMaximum\": 1\n}";

$targetUrl = trim((string)($_POST['target_url'] ?? $defaultTarget));
$contentType = trim((string)($_POST['content_type'] ?? 'application/json'));
$authHeader = trim((string)($_POST['auth_header'] ?? ''));
$requestBody = (string)($_POST['request_body'] ?? $defaultBody);
$result = null;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && isset($_POST['send_test'])) {
    $result = send_debug_request($targetUrl, $contentType !== '' ? $contentType : 'application/json', $requestBody, $authHeader);
}
?><!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LTI Debug Tool</title>
  <style>
    body{margin:0;background:#f5f1ea;color:#1e1b16;font-family:"IBM Plex Sans","Segoe UI",sans-serif;}
    header{padding:20px 20px 8px;}
    h1{margin:0 0 8px;font-size:24px;}
    p{margin:0 0 12px;color:#665d53;}
    .wrap{padding:0 20px 24px;display:grid;gap:14px;}
    .card{background:#fff;border:1px solid #e5ddd0;border-radius:12px;padding:14px;}
    table{width:100%;border-collapse:collapse;font-size:13px;}
    th,td{padding:7px 8px;border-bottom:1px solid #eee4d6;text-align:left;vertical-align:top;}
    th{width:280px;color:#4e453b;}
    code,pre{background:#f3ecdf;border-radius:6px;padding:2px 6px;}
    pre{padding:10px;overflow:auto;}
    label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;}
    input,textarea{width:100%;box-sizing:border-box;border:1px solid #d8ccb9;border-radius:8px;padding:8px 10px;font:inherit;}
    textarea{min-height:140px;resize:vertical;}
    button{margin-top:8px;border:1px solid #2c6f6d;background:#2c6f6d;color:#fff;padding:8px 12px;border-radius:8px;cursor:pointer;}
    .muted{font-size:13px;color:#6d6258;margin-top:6px;}
  </style>
</head>
<body>
  <header>
    <h1>LTI Debug Tool</h1>
    <p>Toont ontvangen launch-data en stuurt optioneel een test-POST naar een opgegeven endpoint.</p>
  </header>

  <div class="wrap">
    <div class="card">
      <strong>Ontvangen launch-parameters</strong>
      <table style="margin-top:8px;">
        <?php if ($params === []): ?>
          <tr><td colspan="2">Geen parameters ontvangen.</td></tr>
        <?php else: ?>
          <?php ksort($params); foreach ($params as $key => $value): ?>
            <tr>
              <th><?php echo h($key); ?></th>
              <td><code><?php echo h(is_sensitive_key($key) ? mask_value($value) : $value); ?></code></td>
            </tr>
          <?php endforeach; ?>
        <?php endif; ?>
      </table>
    </div>

    <div class="card">
      <strong>Test POST terugsturen</strong>
      <p class="muted">Dit is een generieke HTTP POST test. Canvas LTI 1.1 outcome endpoints verwachten meestal OAuth-signed XML; die signing gebeurt hier niet automatisch.</p>
      <form method="post">
        <label for="target_url">Target URL</label>
        <input id="target_url" name="target_url" value="<?php echo h($targetUrl); ?>" placeholder="https://..." />

        <label for="content_type" style="margin-top:8px;">Content-Type</label>
        <input id="content_type" name="content_type" value="<?php echo h($contentType); ?>" />

        <label for="auth_header" style="margin-top:8px;">Authorization header (optioneel)</label>
        <input id="auth_header" name="auth_header" value="<?php echo h($authHeader); ?>" placeholder="Bearer ..." />

        <label for="request_body" style="margin-top:8px;">Request body</label>
        <textarea id="request_body" name="request_body"><?php echo h($requestBody); ?></textarea>

        <button type="submit" name="send_test" value="1">Verstuur test POST</button>
      </form>

      <?php if (is_array($result)): ?>
        <div style="margin-top:12px;">
          <strong>Respons</strong>
          <table style="margin-top:8px;">
            <tr><th>Status</th><td><code><?php echo h((string)$result['status']); ?></code></td></tr>
            <?php if ($result['error'] !== ''): ?>
              <tr><th>Fout</th><td><code><?php echo h($result['error']); ?></code></td></tr>
            <?php endif; ?>
            <tr><th>Headers</th><td><pre><?php echo h((string)$result['headers']); ?></pre></td></tr>
            <tr><th>Body</th><td><pre><?php echo h((string)$result['body']); ?></pre></td></tr>
          </table>
        </div>
      <?php endif; ?>
    </div>
  </div>
</body>
</html>
