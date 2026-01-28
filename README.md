# Learning Tools

Standalone, versie‑gebaseerde quiz‑types die via iframes in Canvas kunnen worden ingeladen. Elk type heeft een `schema.json` voor formulier‑generatie en een `example.json` voor snelle preview.

## Inhoud
- Centrale registry: `public_html/types/registry.json`
- Overzichtspagina: `public_html/index.html`
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

## Voorbeeld URL’s (zonder integratie)
Gebruik de demo’s direct in de browser:
- `/types/juiste-volgorde/v1/?data=example.json`
- `/types/wat-hoort-bij-wat/v1/?data=example.json`
- `/types/pubquiz-yes-no/v1/?data=example.json`

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
- Iframe‑URL: `{launchUrl}?data=<urlencode(dataUrl)>`
- `dataUrl` moet publiek en CORS‑toegankelijk zijn.
- Gebruik altijd versie‑paden (bijv. `/v1/`) voor backwards compatibility.

# ..
