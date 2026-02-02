# AGENTS.md

Deze repo bevat een set versie‑gebaseerde, standalone leertools (meestal quiz‑types) die via iframes worden ingeladen.

## Belangrijkste mappen
- `public_html/types/<tool-id>/<version>/` bevat een tool (HTML/JS/CSS) + `schema.json` + `example.json`.
- `public_html/types/registry.json` is de centrale registry die externe systemen gebruiken om types te ontdekken.

## JSON Schema conventies (formulier‑generatie)
Doel: schema’s moeten zowel valideerbaar als formulier‑vriendelijk zijn (Courses tool).

- Gebruik JSON Schema draft 2020‑12 (`$schema`) en zet een stabiele `$id`.
- Voeg op schema‑root altijd een duidelijke `title` en `description` toe (wat doet de tool).
- Voeg op elke property bij voorkeur `title` (veldlabel) en `description` (hulptekst) toe.
- Voor arrays/objects: geef ook de container (`title`/`description`) en het item‑schema een `title` zodat herhaalbare secties leesbaar blijven.
- Houd schema’s strikt waar mogelijk: `additionalProperties: false` (tenzij er een expliciete reden is om vrije velden toe te laten).
- Houd de taal in schema‑teksten Nederlands (aansluiting op studenten/lesmateriaal).
- Houd JSON op 2‑spatie indent en consistent key‑order (metadata → type → required → additionalProperties → properties).

## Wijzigingen aan tools
- Als je properties hernoemt of semantics wijzigt: check ook de bijbehorende JS (`app.js`/`tool.js`) en pas `example.json` aan.
- Bij nieuwe types/versies: voeg toe aan `public_html/types/registry.json` en update `README.md`.

