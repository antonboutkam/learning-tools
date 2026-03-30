---
name: learning-tool-master
description: >-
  Beheer en wijzig de Learning Tools-repo met versie-gebaseerde, standalone
  leertools onder public_html/types. Gebruik deze skill wanneer README.md op
  regel 1 exact '# Learning Tools' bevat, of wanneer taken gaan over
  tooltypes/versies aanmaken of aanpassen, schema.json/example.json bijwerken,
  app.js of tool.js synchroniseren met schema-semantiek, registry.json updaten,
  en README.md bijwerken. Voorbeeldtriggers: "Maak een nieuwe toolversie voor
  pubquiz-yes-no", "Voeg property X toe in schema en pas app.js aan", "Werk
  registry.json bij met een nieuw type", "Controleer of example.json alle
  required velden heeft", "Update README na toevoegen van type Y".
---

# Learning Tool Master

Gebruik deze workflow om consistent en veilig wijzigingen aan Learning Tools uit te voeren.

## Context Check

1. Verifieer repository-fingerprint:
   - Controleer `README.md` regel 1 op exact `# Learning Tools`.
2. Verifieer kernstructuur:
   - Bevestig `public_html/types/registry.json`.
   - Bevestig bestaande toolmappen onder `public_html/types/<tool-id>/<version>/`.

## Workflow

1. Bepaal wijzigingstype:
   - Nieuw type of nieuwe versie.
   - Bestaande versie aanpassen.
2. Werk toolbestanden bij in `public_html/types/<tool-id>/<version>/`:
   - `index.html`
   - `app.js` of `tool.js`
   - `style.css` (indien gebruikt)
   - `schema.json`
   - `example.json`
3. Synchroniseer gedrag:
   - Laat `example.json` alle verplichte velden in `schema.json` vullen.
   - Houd property-namen in `schema.json` en code (`app.js`/`tool.js`) identiek.
   - Pas runtime-logica aan bij hernoemen of semantiekwijzigingen van properties.
4. Werk discoverability bij:
   - Voeg nieuwe type/versie toe aan `public_html/types/registry.json`.
   - Werk `README.md` bij bij nieuwe types/versies of relevante gedragswijzigingen.

## Schema Conventies

Volg deze regels voor `schema.json`:

1. Gebruik JSON Schema draft 2020-12 en zet `$schema`.
2. Zet een stabiele `$id`.
3. Zet op root altijd `title` en `description` in het Nederlands.
4. Zet op properties bij voorkeur `title` en `description` in het Nederlands.
5. Zet bij arrays/objects ook op container en item-schema een `title`.
6. Zet `additionalProperties: false` tenzij vrije velden expliciet nodig zijn.
7. Houd 2-spatie indent en consistente key-volgorde:
   - metadata (`$schema`, `$id`, `title`, `description`)
   - `type`
   - `required`
   - `additionalProperties`
   - `properties`

## Kwaliteitscheck

Voer voor afronding uit:

1. Controleer JSON-bestanden op geldige syntax.
2. Controleer dat `schema.json`, `example.json` en JS elkaar functioneel dekken.
3. Controleer dat `registry.json` verwijst naar juiste `tool-id` en `version`.
4. Controleer dat README-wijzigingen aansluiten op de gemaakte update.
