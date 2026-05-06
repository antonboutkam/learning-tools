# LTI test URLs (Canvas zonder admin/developer key)

Deze testlaag is bedoeld voor course-level experimenten met **External Tool by URL/XML**.

## Startpunt
- Launch-debug tool (algemeen): `/lti-debug/`
- Per tool launch endpoint: `/types/{tool_slug}/v1/lti/launch/`
- Per tool XML config endpoint: `/types/{tool_slug}/v1/lti/config/?privacy_level=...`

## Data aanleveren (productie en test)
- Standaard gebruikt de launch endpoint deze query-param: `data=<url-naar-json>`.
- In productie kun je dus gewoon een publieke JSON URL meegeven (bijv. vanaf je eigen CMS/Courses backend).
- Laat je `data` weg, dan valt de launch automatisch terug op lokale mock data:
  - `/types/{tool_slug}/v1/lti/mock-data.json`
- De XML config zet `data` standaard al naar die mock-data URL, zodat je direct kunt testen zonder externe afhankelijkheden.
- Canvas custom fields worden ook geaccepteerd:
  - `custom_data` werkt als alternatief voor `data`
  - `custom_unique_id` werkt als alternatief voor `unique_id`
- Je kunt per XML-config ook direct een data-override meegeven:
  - `/types/{tool_slug}/v1/lti/config/?privacy_level=public&data=https%3A%2F%2Fjouwdomein.nl%2Fassignment-123.json`

## Privacy varianten (Canvas LTI 1.1 XML)
- `public`: stuurt zoveel mogelijk gebruikerscontext mee.
- `name_only`: beperkt identiteit, maar bevat doorgaans nog naamgegevens.
- `anonymous`: zo min mogelijk persoonsinformatie.

## Wat kan score/rating terugsturen?
- `launch/` (direct): alleen launch/debug, geen automatische score-passback.
- `config/?privacy_level=*` (LTI 1.1 XML): kan in principe LTI 1.1 outcome/passback gebruiken **als** Canvas course-level app-config een consumer key/shared secret + outcome endpoint levert.
- Zonder admin/developer key is LTI 1.3 AGS (moderne grade passback) normaal niet beschikbaar.
- De debug-tool `/lti-debug/` kan handmatig een test-POST doen naar een endpoint, maar tekent geen OAuth 1.0a request.

## URL matrix per tool

| Tool slug | Launch URL | XML public | XML name_only | XML anonymous | Mock data |
|---|---|---|---|---|---|
| `bin-hex-dec-reken` | `/types/bin-hex-dec-reken/v1/lti/launch/` | `/types/bin-hex-dec-reken/v1/lti/config/?privacy_level=public` | `/types/bin-hex-dec-reken/v1/lti/config/?privacy_level=name_only` | `/types/bin-hex-dec-reken/v1/lti/config/?privacy_level=anonymous` | `/types/bin-hex-dec-reken/v1/lti/mock-data.json` |
| `code-in-volgorde-zetten` | `/types/code-in-volgorde-zetten/v1/lti/launch/` | `/types/code-in-volgorde-zetten/v1/lti/config/?privacy_level=public` | `/types/code-in-volgorde-zetten/v1/lti/config/?privacy_level=name_only` | `/types/code-in-volgorde-zetten/v1/lti/config/?privacy_level=anonymous` | `/types/code-in-volgorde-zetten/v1/lti/mock-data.json` |
| `digitaal-bericht` | `/types/digitaal-bericht/v1/lti/launch/` | `/types/digitaal-bericht/v1/lti/config/?privacy_level=public` | `/types/digitaal-bericht/v1/lti/config/?privacy_level=name_only` | `/types/digitaal-bericht/v1/lti/config/?privacy_level=anonymous` | `/types/digitaal-bericht/v1/lti/mock-data.json` |
| `juiste-volgorde` | `/types/juiste-volgorde/v1/lti/launch/` | `/types/juiste-volgorde/v1/lti/config/?privacy_level=public` | `/types/juiste-volgorde/v1/lti/config/?privacy_level=name_only` | `/types/juiste-volgorde/v1/lti/config/?privacy_level=anonymous` | `/types/juiste-volgorde/v1/lti/mock-data.json` |
| `kies-de-juiste-afbeelding` | `/types/kies-de-juiste-afbeelding/v1/lti/launch/` | `/types/kies-de-juiste-afbeelding/v1/lti/config/?privacy_level=public` | `/types/kies-de-juiste-afbeelding/v1/lti/config/?privacy_level=name_only` | `/types/kies-de-juiste-afbeelding/v1/lti/config/?privacy_level=anonymous` | `/types/kies-de-juiste-afbeelding/v1/lti/mock-data.json` |
| `markdown-editor` | `/types/markdown-editor/v1/lti/launch/` | `/types/markdown-editor/v1/lti/config/?privacy_level=public` | `/types/markdown-editor/v1/lti/config/?privacy_level=name_only` | `/types/markdown-editor/v1/lti/config/?privacy_level=anonymous` | `/types/markdown-editor/v1/lti/mock-data.json` |
| `notities` | `/types/notities/v1/lti/launch/` | `/types/notities/v1/lti/config/?privacy_level=public` | `/types/notities/v1/lti/config/?privacy_level=name_only` | `/types/notities/v1/lti/config/?privacy_level=anonymous` | `/types/notities/v1/lti/mock-data.json` |
| `pubquiz-yes-no` | `/types/pubquiz-yes-no/v1/lti/launch/` | `/types/pubquiz-yes-no/v1/lti/config/?privacy_level=public` | `/types/pubquiz-yes-no/v1/lti/config/?privacy_level=name_only` | `/types/pubquiz-yes-no/v1/lti/config/?privacy_level=anonymous` | `/types/pubquiz-yes-no/v1/lti/mock-data.json` |
| `strip-ballonnetjes` | `/types/strip-ballonnetjes/v1/lti/launch/` | `/types/strip-ballonnetjes/v1/lti/config/?privacy_level=public` | `/types/strip-ballonnetjes/v1/lti/config/?privacy_level=name_only` | `/types/strip-ballonnetjes/v1/lti/config/?privacy_level=anonymous` | `/types/strip-ballonnetjes/v1/lti/mock-data.json` |
| `timeline` | `/types/timeline/v1/lti/launch/` | `/types/timeline/v1/lti/config/?privacy_level=public` | `/types/timeline/v1/lti/config/?privacy_level=name_only` | `/types/timeline/v1/lti/config/?privacy_level=anonymous` | `/types/timeline/v1/lti/mock-data.json` |
| `wat-hoort-bij-wat` | `/types/wat-hoort-bij-wat/v1/lti/launch/` | `/types/wat-hoort-bij-wat/v1/lti/config/?privacy_level=public` | `/types/wat-hoort-bij-wat/v1/lti/config/?privacy_level=name_only` | `/types/wat-hoort-bij-wat/v1/lti/config/?privacy_level=anonymous` | `/types/wat-hoort-bij-wat/v1/lti/mock-data.json` |

## Korte smoke-test (5 stappen)
1. Open eerst `/lti-debug/` in de browser om te verifiëren dat de server draait.
2. Voeg in Canvas (course-level) een External Tool toe via **By URL** met een van de XML URLs hierboven (`privacy_level=public` als eerste test).
3. Maak een assignment met `submission_types=["external_tool"]` en kies de zojuist toegevoegde tool.
4. Open als student/test user de opdracht en controleer in `launch/` of `user_id`, `course_id`, `context_id` en eventuele `custom_*` velden binnenkomen.
5. Test daarna `name_only` en `anonymous` om te vergelijken welke velden Canvas nog meestuurt.

## Aanbevolen testvolgorde
1. `public` XML
2. `name_only` XML
3. `anonymous` XML
4. Test met eigen `data=<publieke-json-url>`
5. Handmatige POST test via `/lti-debug/` als je een outcome URL wilt inspecteren.
