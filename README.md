# Learning Tools

Standalone, versie‑gebaseerde quiz‑types die via iframes in Canvas kunnen worden ingeladen. Elk type heeft een `schema.json` voor formulier‑generatie en een `example.json` voor snelle preview.

## Inhoud
- Centrale registry: `public_html/types/registry.json`
- Overzichtspagina: `public_html/index.php`
- Prompt‑instructies voor Courses: `COURSES_PROMPT.md`
- Docs: `docs/`
- Examples: `docs/examples/`

## Beschikbare tools (quiz‑types)
- Juiste volgorde (v1)
  - Pad: `public_html/types/juiste-volgorde/v1/`
  - Data‑schema: `public_html/types/juiste-volgorde/v1/schema.json`
  - Example: `public_html/types/juiste-volgorde/v1/example.json`

- Wat hoort bij wat (v1)
  - Pad: `public_html/types/wat-hoort-bij-wat/v1/`
  - Data‑schema: `public_html/types/wat-hoort-bij-wat/v1/schema.json`
  - Example: `public_html/types/wat-hoort-bij-wat/v1/example.json`

- Pubquiz yes/no (v1)
  - Pad: `public_html/types/pubquiz-yes-no/v1/`
  - Data‑schema: `public_html/types/pubquiz-yes-no/v1/schema.json`
  - Example: `public_html/types/pubquiz-yes-no/v1/example.json`

- Digitaal bericht (C64) (v1)
  - Pad: `public_html/types/digitaal-bericht/v1/`
  - Data‑schema: `public_html/types/digitaal-bericht/v1/schema.json`
  - Example: `public_html/types/digitaal-bericht/v1/example.json`

- Strip ballonnetjes (v1)
  - Pad: `public_html/types/strip-ballonnetjes/v1/`
  - Data‑schema: `public_html/types/strip-ballonnetjes/v1/schema.json`
  - Example: `public_html/types/strip-ballonnetjes/v1/example.json`

- Notities (v1)
  - Pad: `public_html/types/notities/v1/`
  - Data‑schema: `public_html/types/notities/v1/schema.json`
  - Example: `public_html/types/notities/v1/example.json`

## Voorbeeld URL’s (zonder integratie)
Gebruik de demo’s direct in de browser:
- `/types/juiste-volgorde/v1/?unique_id=demo-volgorde-1&data=example.json`
- `/types/wat-hoort-bij-wat/v1/?unique_id=demo-koppelen-1&data=example.json`
- `/types/pubquiz-yes-no/v1/?unique_id=demo-pubquiz-1&data=example.json`
- `/types/digitaal-bericht/v1/?unique_id=demo-bericht-1&data=example.json`
- `/types/strip-ballonnetjes/v1/?unique_id=demo-strip-1&data=example.json`
- `/types/notities/v1/?notitieblok_id=demo-notities-1&data=example.json`

## Docs
- Prompt‑instructies: `COURSES_PROMPT.md`
- Registry + schema contract: `public_html/types/registry.json`
- LTI inzendingen (Canvas): `docs/lti-submission.md`
- LTI config voorbeeld: `docs/lti-config-example.json`
- Overzicht examples: `docs/examples/README.md`

## Docs/examples
- `docs/examples/juiste-volgorde.v1.example.json`
- `docs/examples/wat-hoort-bij-wat.v1.example.json`
- `docs/examples/pubquiz-yes-no.v1.example.json`

## Data‑contract (kort)
- Iframe‑URL: `{launchUrl}?unique_id=<id>&data=<urlencode(dataUrl)>`
- `dataUrl` moet publiek en CORS‑toegankelijk zijn.
- Gebruik altijd versie‑paden (bijv. `/v1/`) voor backwards compatibility.
- Registry items hebben een `type` veld (bijv. `assignment-type`) zodat later ook visualisaties toegevoegd kunnen worden.

## Schema UX‑metadata (titles/descriptions)
De `schema.json` bestanden bevatten extra metadata om het automatisch gegenereerde formulier in Courses (of een andere builder) gebruiksvriendelijker te maken:
- Gebruik schema root `title` + `description` als naam/uitleg van de tool.
- Gebruik per property `title` als veldlabel en `description` als hulptekst.
- Voor arrays/objects zijn ook titels/omschrijvingen toegevoegd zodat herhaalbare secties leesbaar blijven.
