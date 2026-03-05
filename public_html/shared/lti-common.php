<?php
declare(strict_types=1);

function lti_h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * @return array<string, string>
 */
function lti_collect_request_params(): array
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

function lti_is_sensitive_key(string $key): bool
{
    return (bool)preg_match('/(token|secret|signature|password|id_token|jwt|oauth_)/i', $key);
}

function lti_mask_value(string $value): string
{
    $length = strlen($value);
    if ($length <= 8) {
        return str_repeat('*', $length);
    }

    return substr($value, 0, 4) . str_repeat('*', max(2, $length - 8)) . substr($value, -4);
}

/**
 * @return array{name: string, description: string}
 */
function lti_tool_meta(string $toolSlug): array
{
    $registryPath = __DIR__ . '/../types/registry.json';
    if (!is_file($registryPath)) {
        return ['name' => $toolSlug, 'description' => ''];
    }

    $json = file_get_contents($registryPath);
    if ($json === false) {
        return ['name' => $toolSlug, 'description' => ''];
    }

    $decoded = json_decode($json, true);
    if (!is_array($decoded) || !isset($decoded['types']) || !is_array($decoded['types'])) {
        return ['name' => $toolSlug, 'description' => ''];
    }

    foreach ($decoded['types'] as $type) {
        if (!is_array($type)) {
            continue;
        }
        if ((string)($type['id'] ?? '') !== $toolSlug) {
            continue;
        }

        return [
            'name' => trim((string)($type['name'] ?? $toolSlug)) ?: $toolSlug,
            'description' => trim((string)($type['description'] ?? '')),
        ];
    }

    return ['name' => $toolSlug, 'description' => ''];
}

function lti_origin(): string
{
    $https = $_SERVER['HTTPS'] ?? '';
    $scheme = (!empty($https) && strtolower((string)$https) !== 'off') ? 'https' : 'http';
    $host = trim((string)($_SERVER['HTTP_HOST'] ?? 'localhost'));

    return $scheme . '://' . $host;
}

function lti_notebook_or_unique_id(array $params, string $toolSlug): string
{
    if (!empty($params['custom_unique_id'])) {
        return (string)$params['custom_unique_id'];
    }

    if (!empty($params['unique_id'])) {
        return (string)$params['unique_id'];
    }

    if (!empty($params['custom_notitieblok_id'])) {
        return (string)$params['custom_notitieblok_id'];
    }

    if (!empty($params['notitieblok_id'])) {
        return (string)$params['notitieblok_id'];
    }

    if (!empty($params['user_id'])) {
        return 'canvas-' . preg_replace('/[^a-zA-Z0-9_.-]/', '-', (string)$params['user_id']) . '-' . $toolSlug . '-test';
    }

    return 'demo-' . $toolSlug . '-test';
}

/**
 * @return array<string, string>
 */
function lti_forward_query_params(array $params, string $toolSlug, string $dataUrl, string $uniqueId): array
{
    $forward = [
        'tool_slug' => $toolSlug,
        'data' => $dataUrl,
        'unique_id' => $uniqueId,
        'notitieblok_id' => $uniqueId,
    ];

    $allowList = [
        'user_id',
        'course_id',
        'context_id',
        'resource_link_id',
        'roles',
        'launch_presentation_return_url',
        'lis_person_name_full',
        'lis_person_contact_email_primary',
        'lis_result_sourcedid',
        'lis_outcome_service_url',
    ];

    foreach ($allowList as $key) {
        if (!empty($params[$key])) {
            $forward[$key] = (string)$params[$key];
        }
    }

    foreach ($params as $key => $value) {
        if (strpos($key, 'custom_') === 0 && $value !== '') {
            $forward[$key] = (string)$value;
        }
    }

    return $forward;
}

function lti_render_launch_page(string $toolSlug, string $version): void
{
    $version = trim($version);
    if ($version === '') {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Version ontbreekt.';
        return;
    }

    $toolIndexPath = __DIR__ . '/../types/' . $toolSlug . '/' . $version . '/index.html';
    $toolIndexPhpPath = __DIR__ . '/../types/' . $toolSlug . '/' . $version . '/index.php';
    if (!is_file($toolIndexPath) && !is_file($toolIndexPhpPath)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Onbekende tool of versie: ' . $toolSlug . '/' . $version;
        return;
    }

    $params = lti_collect_request_params();
    $meta = lti_tool_meta($toolSlug);

    $dataUrl = trim((string)($params['data'] ?? ''));
    if ($dataUrl === '') {
        $dataUrl = trim((string)($params['custom_data'] ?? ''));
    }
    if ($dataUrl === '') {
        $dataUrl = '/types/' . $toolSlug . '/' . $version . '/lti/mock-data.json';
    }

    $uniqueId = lti_notebook_or_unique_id($params, $toolSlug);
    $forwardParams = lti_forward_query_params($params, $toolSlug, $dataUrl, $uniqueId);
    $iframeSrc = '/types/' . $toolSlug . '/' . $version . '/?' . http_build_query($forwardParams, '', '&', PHP_QUERY_RFC3986);

    header('Content-Type: text/html; charset=utf-8');

    echo '<!doctype html>';
    echo '<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    echo '<title>' . lti_h($meta['name']) . ' - LTI launch test</title>';
    echo '<style>';
    echo 'body{margin:0;background:#f6f2ea;color:#201b14;font-family:IBM Plex Sans,Segoe UI,sans-serif;}';
    echo 'header{padding:16px 20px 8px;}';
    echo 'h1{margin:0 0 8px;font-size:22px;}';
    echo 'p{margin:0 0 10px;color:#665a4f;}';
    echo '.layout{padding:0 20px 20px;display:grid;gap:14px;}';
    echo '.card{background:#fff;border:1px solid #e6dece;border-radius:12px;padding:14px;}';
    echo '.meta{font-size:13px;color:#6d6258;margin-top:6px;}';
    echo 'table{width:100%;border-collapse:collapse;font-size:13px;}';
    echo 'th,td{padding:6px 8px;border-bottom:1px solid #eee3d4;text-align:left;vertical-align:top;}';
    echo 'th{width:240px;color:#4d463d;}';
    echo 'code{background:#f3ecdf;border-radius:6px;padding:2px 6px;}';
    echo '.frame-wrap{background:#fff;border:1px solid #e6dece;border-radius:12px;padding:10px;}';
    echo 'iframe{border:0;width:100%;height:75vh;min-height:580px;background:#fff;border-radius:8px;}';
    echo '</style></head><body>';

    echo '<header>';
    echo '<h1>' . lti_h($meta['name']) . ' - LTI launch test</h1>';
    if ($meta['description'] !== '') {
        echo '<p>' . lti_h($meta['description']) . '</p>';
    }
    echo '<p class="meta">Tool: <code>' . lti_h($toolSlug) . '</code> · versie: <code>' . lti_h($version) . '</code></p>';
    echo '</header>';

    echo '<div class="layout">';
    echo '<div class="card">';
    echo '<strong>Launch info</strong>';
    echo '<table>';
    echo '<tr><th>Launch endpoint</th><td><code>/types/' . lti_h($toolSlug) . '/' . lti_h($version) . '/lti/launch/</code></td></tr>';
    echo '<tr><th>Iframe src</th><td><code>' . lti_h($iframeSrc) . '</code></td></tr>';
    echo '<tr><th>Actieve data URL</th><td><code>' . lti_h($dataUrl) . '</code></td></tr>';
    echo '<tr><th>Actieve unique_id</th><td><code>' . lti_h($uniqueId) . '</code></td></tr>';
    echo '<tr><th>Request method</th><td><code>' . lti_h((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) . '</code></td></tr>';
    echo '</table>';

    echo '<div style="margin-top:10px;">';
    echo '<strong>Ontvangen launch-parameters</strong>';
    echo '<table style="margin-top:6px;">';
    if ($params === []) {
        echo '<tr><td colspan="2">Geen parameters ontvangen.</td></tr>';
    } else {
        ksort($params);
        foreach ($params as $key => $value) {
            $safeValue = lti_is_sensitive_key($key) ? lti_mask_value($value) : $value;
            echo '<tr><th>' . lti_h($key) . '</th><td><code>' . lti_h($safeValue) . '</code></td></tr>';
        }
    }
    echo '</table>';
    echo '</div>';

    echo '</div>';
    echo '<div class="frame-wrap"><iframe src="' . lti_h($iframeSrc) . '" loading="lazy" referrerpolicy="no-referrer"></iframe></div>';
    echo '</div>';
    echo '</body></html>';
}

function lti_render_config_xml(string $toolSlug, string $version): void
{
    $meta = lti_tool_meta($toolSlug);
    $version = trim($version);

    $privacy = strtolower(trim((string)($_GET['privacy_level'] ?? 'public')));
    $allowed = ['public', 'name_only', 'anonymous'];
    if (!in_array($privacy, $allowed, true)) {
        $privacy = 'public';
    }

    $origin = lti_origin();
    $launchUrl = $origin . '/types/' . $toolSlug . '/' . $version . '/lti/launch/';
    $mockDataUrl = $origin . '/types/' . $toolSlug . '/' . $version . '/lti/mock-data.json';
    $dataOverride = trim((string)($_GET['data'] ?? ''));
    $customDataUrl = $dataOverride !== '' ? $dataOverride : $mockDataUrl;
    $title = $meta['name'] . ' ' . $version . ' (LTI test: ' . $privacy . ')';

    header('Content-Type: application/xml; charset=utf-8');

    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    ?>
<cartridge_basiclti_link
    xmlns="http://www.imsglobal.org/xsd/imslticc_v1p0"
    xmlns:blti="http://www.imsglobal.org/xsd/imsbasiclti_v1p0"
    xmlns:lticm="http://www.imsglobal.org/xsd/imslticm_v1p0"
    xmlns:lticp="http://www.imsglobal.org/xsd/imslticp_v1p0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.imsglobal.org/xsd/imslticc_v1p0 http://www.imsglobal.org/profile/cc/ccv1p3/ccv1p3_lti_v1p0.xsd">
  <blti:title><?php echo lti_h($title); ?></blti:title>
  <blti:description><?php echo lti_h($meta['description'] !== '' ? $meta['description'] : ('Test-config voor tool ' . $toolSlug)); ?></blti:description>
  <blti:launch_url><?php echo lti_h($launchUrl); ?></blti:launch_url>
  <blti:extensions platform="canvas.instructure.com">
    <lticm:property name="domain"><?php echo lti_h(parse_url($origin, PHP_URL_HOST) ?: ''); ?></lticm:property>
    <lticm:property name="privacy_level"><?php echo lti_h($privacy); ?></lticm:property>
    <lticm:property name="text"><?php echo lti_h($meta['name'] . ' ' . $version); ?></lticm:property>
    <lticm:property name="selection_width">1200</lticm:property>
    <lticm:property name="selection_height">800</lticm:property>
  </blti:extensions>
  <blti:custom>
    <lticm:property name="tool_slug"><?php echo lti_h($toolSlug); ?></lticm:property>
    <lticm:property name="tool_version"><?php echo lti_h($version); ?></lticm:property>
    <lticm:property name="unique_id">$Canvas.user.id-<?php echo lti_h($toolSlug); ?>-<?php echo lti_h($version); ?>-test</lticm:property>
    <lticm:property name="user_id">$Canvas.user.id</lticm:property>
    <lticm:property name="course_id">$Canvas.course.id</lticm:property>
    <lticm:property name="data"><?php echo lti_h($customDataUrl); ?></lticm:property>
  </blti:custom>
</cartridge_basiclti_link>
<?php
}
