<?php
declare(strict_types=1);

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function starts_with(string $haystack, string $needle): bool
{
    return strncmp($haystack, $needle, strlen($needle)) === 0;
}

/**
 * @return array<int, array<string, mixed>>
 */
function load_registry_types(string $registryPath): array
{
    if (!is_file($registryPath)) {
        return [];
    }

    $json = file_get_contents($registryPath);
    if ($json === false) {
        return [];
    }

    $data = json_decode($json, true);
    if (!is_array($data)) {
        return [];
    }

    $types = $data['types'] ?? [];
    return is_array($types) ? $types : [];
}

/**
 * Fallback als registry ontbreekt/kapot is: scan folders in /types.
 *
 * @return array<int, array<string, mixed>>
 */
function scan_types_dir(string $typesDir): array
{
    if (!is_dir($typesDir)) {
        return [];
    }

    $out = [];
    $typeDirs = glob($typesDir . '/*', GLOB_ONLYDIR) ?: [];
    foreach ($typeDirs as $typePath) {
        $typeId = basename($typePath);
        $versionDirs = glob($typePath . '/*', GLOB_ONLYDIR) ?: [];
        foreach ($versionDirs as $versionPath) {
            $version = basename($versionPath);
            $launchUrl = '/types/' . $typeId . '/' . $version . '/';
            if (!is_file($versionPath . '/index.html') && !is_file($versionPath . '/index.php')) {
                continue;
            }
            $out[] = [
                'id' => $typeId,
                'type' => 'assignment-type',
                'name' => ucwords(str_replace('-', ' ', $typeId)),
                'version' => $version,
                'launchUrl' => $launchUrl,
                'schemaUrl' => $launchUrl . 'schema.json',
                'exampleDataUrl' => $launchUrl . 'example.json',
                'description' => null,
            ];
        }
    }

    return $out;
}

$registryPath = __DIR__ . '/types/registry.json';
$registryTypes = load_registry_types($registryPath);
$scannedTypes = scan_types_dir(__DIR__ . '/types');

// Basis = wat er fysiek bestaat; registry vult aan met labels/metadata.
if ($scannedTypes) {
    $registryIndex = [];
    foreach ($registryTypes as $t) {
        if (!is_array($t)) {
            continue;
        }
        $id = (string)($t['id'] ?? '');
        $version = (string)($t['version'] ?? '');
        if ($id === '' || $version === '') {
            continue;
        }
        $registryIndex[$id . '|' . $version] = $t;
    }

    $types = [];
    foreach ($scannedTypes as $s) {
        $id = (string)($s['id'] ?? '');
        $version = (string)($s['version'] ?? '');
        $key = $id !== '' && $version !== '' ? ($id . '|' . $version) : null;
        $types[] = ($key !== null && isset($registryIndex[$key])) ? array_merge($s, $registryIndex[$key]) : $s;
    }
} else {
    $types = $registryTypes;
}

// Normaliseer en filter op bruikbare entries.
$normalized = [];
foreach ($types as $t) {
    if (!is_array($t)) {
        continue;
    }
    $launchUrl = (string)($t['launchUrl'] ?? '');
    if ($launchUrl === '') {
        continue;
    }
    if (!starts_with($launchUrl, '/')) {
        $launchUrl = '/' . $launchUrl;
    }
    $launchUrl = rtrim($launchUrl, '/') . '/';

    $id = (string)($t['id'] ?? '');
    $version = (string)($t['version'] ?? '');
    $name = trim((string)($t['name'] ?? $id));
    $description = (string)($t['description'] ?? '');
    $schemaUrl = (string)($t['schemaUrl'] ?? '');
    $exampleDataUrl = (string)($t['exampleDataUrl'] ?? '');

    $uniqueId = 'demo' . ($id !== '' ? '-' . $id : '') . ($version !== '' ? '-' . $version : '');
    $dataParam = $exampleDataUrl !== '' ? $exampleDataUrl : 'example.json';
    $demoUrl = $launchUrl . '?unique_id=' . rawurlencode($uniqueId) . '&data=' . rawurlencode($dataParam);

    $normalized[] = [
        'id' => $id,
        'name' => $name !== '' ? $name : $launchUrl,
        'version' => $version,
        'launchUrl' => $launchUrl,
        'description' => $description,
        'schemaUrl' => $schemaUrl,
        'exampleDataUrl' => $exampleDataUrl,
        'demoUrl' => $demoUrl,
    ];
}

usort(
    $normalized,
    static function (array $a, array $b): int {
        $byName = strcasecmp($a['name'], $b['name']);
        if ($byName !== 0) {
            return $byName;
        }
        return strcasecmp((string)$a['version'], (string)$b['version']);
    }
);

?><!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Learning Tools - Quiz Types</title>
  <style>
    :root { --bg:#f4f1ec; --ink:#1e1b16; --accent:#2b6f6d; --card:#fff; --muted:#6c6258; }
    body { font-family: "IBM Plex Serif", "Georgia", serif; margin: 0; background: var(--bg); color: var(--ink); }
    header { padding: 24px 20px 8px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { margin: 0 0 16px; color: var(--muted); }
    .wrap { padding: 0 20px 40px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .card { background: var(--card); border: 1px solid #e6dfd5; border-radius: 14px; padding: 16px; box-shadow: 0 6px 20px rgba(0,0,0,.05); }
    .card h2 { font-size: 18px; margin: 0 0 6px; }
    .meta { font-size: 13px; color: var(--muted); }
    .actions { margin: 10px 0 0; display: flex; gap: 12px; flex-wrap: wrap; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #efe8dd; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <header>
    <h1>Learning Tools - Quiz Types</h1>
    <p>Standalone quiz types met versie-mappen en JSON schema's.</p>
  </header>
  <div class="wrap">
    <div class="card" style="margin-bottom:16px;">
      Centrale registry: <code>/types/registry.json</code><br />
      Gebruik: <code>?unique_id=...&amp;data=URL-naar-json</code> (GET)
    </div>

    <div class="grid">
      <?php foreach ($normalized as $t): ?>
        <div class="card">
          <h2><?php echo h($t['name']); ?><?php echo $t['version'] !== '' ? ' (' . h($t['version']) . ')' : ''; ?></h2>
          <div class="meta"><?php echo h($t['launchUrl']); ?></div>
          <?php if ($t['description'] !== ''): ?>
            <p><?php echo h($t['description']); ?></p>
          <?php endif; ?>
          <div class="actions">
            <a href="<?php echo h($t['demoUrl']); ?>">Open demo</a>
            <?php if ($t['schemaUrl'] !== ''): ?>
              <a href="<?php echo h($t['schemaUrl']); ?>">Schema</a>
            <?php endif; ?>
            <?php if ($t['exampleDataUrl'] !== ''): ?>
              <a href="<?php echo h($t['exampleDataUrl']); ?>">Voorbeelddata</a>
            <?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</body>
</html>
