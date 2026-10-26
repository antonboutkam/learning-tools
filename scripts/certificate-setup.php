<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/certificates/service.php';
if (PHP_SAPI !== 'cli' || $argc !== 2) { fwrite(STDERR, "Gebruik: php scripts/certificate-setup.php /absoluut/pad/buiten/webroot\n"); exit(1); }
umask(0077);
$dir = rtrim($argv[1], '/');
if (!str_starts_with($dir, '/') || file_exists($dir)) { fwrite(STDERR, "Kies een nieuw absoluut pad buiten de webroot.\n"); exit(1); }
$public = realpath(dirname(__DIR__) . '/public_html');
$parent = realpath(dirname($dir));
if (!$parent || $parent === $public || str_starts_with($parent, $public . '/')) { fwrite(STDERR, "De bovenliggende map moet bestaan en buiten public_html staan.\n"); exit(1); }
mkdir($dir, 0700); mkdir($dir . '/records', 0700); mkdir($dir . '/manifests', 0700);
$pair = sodium_crypto_sign_keypair(); $keyId = 'certificates-' . gmdate('Y') . '-' . bin2hex(random_bytes(4));
file_put_contents($dir . '/secret.key', base64_encode(sodium_crypto_sign_secretkey($pair)) . "\n");
file_put_contents($dir . '/public-keys.json', lt_json([$keyId => base64_encode(sodium_crypto_sign_publickey($pair))]) . "\n");
file_put_contents($dir . '/config.json', lt_json(['keyId' => $keyId, 'secretKeyFile' => $dir . '/secret.key', 'recordDir' => $dir . '/records', 'manifestDir' => $dir . '/manifests']) . "\n");
copy(dirname(__DIR__) . '/public_html/types/opdrachtcertificaat/v1/example.json', $dir . '/manifests/demo-certificaat--1.json');
echo "Ingericht. Stel voor PHP LT_CERTIFICATE_CONFIG in op $dir/config.json\nPublieke verificatiesleutels: $dir/public-keys.json\n";
