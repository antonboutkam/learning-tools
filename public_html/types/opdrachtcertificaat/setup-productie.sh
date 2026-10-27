#!/usr/bin/env bash
set -Eeuo pipefail

# Start op de productieserver als: bash setup-productie.sh
if [[ $EUID -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

read -r -p 'Bevestig: dit is de productieserver learning-tools.devroc.nl [ja/nee]: ' answer
[[ $answer == ja ]] || { echo 'Afgebroken.'; exit 1; }

current=/var/www/dynamic/learning-tools.devroc.nl/current
shared=/var/www/dynamic/learning-tools.devroc.nl/shared
api=https://learning-tools.devroc.nl/types/opdrachtcertificaat/v1/api.php
[[ -f "$current/scripts/certificate-setup.php" && -f "$current/public_html/types/opdrachtcertificaat/v1/api.php" && -d "$shared" ]] || {
  echo 'Deploypad of shared-map ontbreekt. Controleer docs/environments.md.' >&2; exit 1;
}
command -v php >/dev/null
command -v curl >/dev/null
command -v runuser >/dev/null
php -r 'exit(PHP_VERSION_ID >= 80100 && extension_loaded("sodium") ? 0 : 1);' || {
  echo 'PHP 8.1+ met Sodium is vereist.' >&2; exit 1;
}

read -r -p 'Absoluut pad van de PHP-FPM-poolconfiguratie (bijv. /etc/php/8.3/fpm/pool.d/www.conf): ' pool
[[ -f $pool && $pool == /* ]] || { echo 'Poolbestand ontbreekt.' >&2; exit 1; }
read -r -p 'Naam van de PHP-FPM-systemd-service (bijv. php8.3-fpm): ' service
[[ $service =~ ^[a-zA-Z0-9@._-]+$ ]] || { echo 'Ongeldige servicenaam.' >&2; exit 1; }
systemctl status "$service" >/dev/null || { echo 'Service niet gevonden of niet actief.' >&2; exit 1; }

webuser=$(awk -F= '/^[[:space:]]*user[[:space:]]*=/ {gsub(/[[:space:]]/, "", $2); print $2; exit}' "$pool")
[[ -n $webuser ]] && id "$webuser" >/dev/null || { echo 'Geen geldige user= in de pool gevonden.' >&2; exit 1; }
echo "PHP-FPM draait als $webuser. Private bestanden komen onder $shared/opdrachtcertificaat."
read -r -p 'Inrichten en PHP-FPM herladen? [ja/nee]: ' answer
[[ $answer == ja ]] || { echo 'Afgebroken.'; exit 1; }

private="$shared/opdrachtcertificaat"
if [[ ! -e $private ]]; then
  # De setup weigert bestaande mappen en overschrijft dus nooit een sleutel.
  php "$current/scripts/certificate-setup.php" "$private"
  chown -R "$webuser" "$private"
else
  [[ -f "$private/config.json" && -f "$private/secret.key" && -d "$private/records" && -d "$private/manifests" ]] || {
    echo "Bestaande map $private is onvolledig; geen sleutel overschreven." >&2; exit 1;
  }
  echo 'Bestaande sleutel en configuratie worden hergebruikt.'
fi

runuser -u "$webuser" -- php -r '
  $c = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
  foreach (["keyId", "secretKeyFile", "recordDir", "manifestDir"] as $k) if (empty($c[$k])) exit(1);
  if (!is_readable($c["secretKeyFile"]) || !is_readable($c["manifestDir"] . "/demo-certificaat--1.json") || !is_writable($c["recordDir"])) exit(1);
' "$private/config.json" || { echo 'PHP-gebruiker kan private bestanden niet lezen of records niet schrijven.' >&2; exit 1; }

backup=$(mktemp "${pool}.certificate-backup.XXXXXX")
cp -p "$pool" "$backup"
tmp=$(mktemp "${pool}.certificate-new.XXXXXX")
awk '!/^[[:space:]]*env\[LT_CERTIFICATE_CONFIG\][[:space:]]*=/' "$pool" > "$tmp"
printf '\nenv[LT_CERTIFICATE_CONFIG] = %s/config.json\n' "$private" >> "$tmp"
chmod --reference="$pool" "$tmp"
chown --reference="$pool" "$tmp"
mv "$tmp" "$pool"

if ! systemctl reload "$service"; then
  cp -p "$backup" "$pool"
  systemctl reload "$service" || true
  echo "Herladen mislukt; poolconfiguratie hersteld. Back-up: $backup" >&2
  exit 1
fi

response=$(mktemp)
status=$(curl --silent --show-error --output "$response" --write-out '%{http_code}' \
  --header 'Content-Type: application/json' \
  --data '{"action":"manifest","groupId":"demo-certificaat","revision":"1"}' "$api") || status=000
if [[ $status != 200 ]] || ! php -r '$v=json_decode(file_get_contents($argv[1]),true); exit(($v["groupId"]??null)==="demo-certificaat" ? 0 : 1);' "$response"; then
  echo "API-controle mislukt (HTTP $status). Poolback-up: $backup" >&2
  rm -f "$response"
  exit 1
fi
rm -f "$response"
echo "Gereed: HTTPS API geeft het demomanifest terug. Configuratie: $private/config.json"
echo "Poolback-up: $backup"
echo 'Plaats echte lesmanifesten in de manifests-map als <groupId>--<revision>.json.'
