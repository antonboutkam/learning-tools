# Handoff: implementeer config-URL-velden in Courses

Deze handoff is bedoeld om in een **schone Codex-chat in de Courses-repository** uit te voeren. De Learning Tools-kant heeft al het schemaformaat en de iframe-berichtafspraak. Implementeer hier alleen de Courses-consumer.

## Startopdracht voor de Courses-sessie

> Werk in `/home/anton/Documents/sites/courses` aan de Courses-consumer voor Learning Tools-config-URL-velden. Lees eerst de actuele `AGENTS.md`, `.codex/agents/SHARED_CONTEXT.md` en `.codex/agents/protocols/framework-technical.md`. Controleer `git status` en behoud alle bestaande wijzigingen. Implementeer het schemaformaat `learning-tool-config-url` zoals beschreven in `/home/anton/Documents/sites/learning-tools/docs/courses-config-url-implementation.md`. Wijzig alleen de Courses-repository. Werk het bestaande admin-schemaformulier uit; voeg geen nieuwe opslag-API toe. Bouw na wijziging van `public_html/js/admin.js` de gebruikte geminificeerde asset opnieuw. Test create, edit, save, reload, arrays met meerdere editors en afwijzing van ongeldige `postMessage`-berichten in de browser.

## Bestaand Courses-pad (opnieuw controleren voor implementatie)

De relevante code bevond zich bij inspectie in:

- `public_html/js/admin.js`: registry/schema laden, recursieve `renderField`, `extractValue`, `validateField`, modal openen en opslaan.
- `modules/Admin/edit.twig`: adminformulier/modal en configuratie van de Learning Tools-proxy.
- `modules/Admin/EditController.php::doLearnToolSave()`: slaat de ontvangen `data` op als cursuslokale JSON onder `assets/learn-tool/assignment-data/` en geeft een `data_url` terug.
- `modules/LearnTool/LearningToolsHttpProxyController.php`: proxy voor schema en registry; registry-URL’s worden herschreven, maar `x-config-url.url` in een schema wordt niet automatisch een iframe-URL.
- `src/Template/Functions/LearnToolFunction.php` en `courses/blocks/learn-tool-frame.twig`: laden de studentweergave via de normale launch-URL met `data`, `unique_id` en cursusweergaveparameters.
- `package.json`: bevat het commando `npm run build:admin-js` voor `public_html/js/admin.min.js`. Controleer in de actuele `edit.twig` welke bundle werkelijk geladen wordt.

De schema-editor rendert objecten en arrays recursief. `extractValue()` maakt momenteel objecten vanuit de childvelden; `validateField()` valideert dezelfde boom van DOM-velden. De config-URL-widget moet die flow uitbreiden zonder objectwaarden als dubbel-geëncodeerde JSON-strings in de opgeslagen tooldata te zetten.

## Schema-contract

Een config-URL is een JSON Schema-property met het standaard onderliggende type `object` en het Courses-specifieke format `learning-tool-config-url`. `x-config-url` bevat de editor-URL, afmetingen en berichtnaam. Voorbeeld uit `public_html/types/breadboard/v1/schema.json`:

```json
{
  "type": "object",
  "title": "Breadboard-configuratie",
  "description": "Bewaar de tekening die in de configurator is gemaakt.",
  "format": "learning-tool-config-url",
  "x-config-url": {
    "url": "/types/breadboard/v1/?mode=config",
    "width": 1120,
    "height": 760,
    "valueType": "application/json",
    "messageType": "learning-tool:config-change"
  },
  "additionalProperties": false,
  "properties": {
    "canvasWidth": { "type": "integer", "title": "Canvasbreedte (px)" },
    "canvasHeight": { "type": "integer", "title": "Canvashoogte (px)" },
    "components": { "type": "array", "title": "Componenten", "items": { "type": "object" } },
    "wires": { "type": "array", "title": "Draden", "items": { "type": "object" } }
  }
}
```

Dit is UI-metadata voor Courses, geen nieuw JSON Schema `type`. Behoud dus `type: object` voor bestaande validators en opgeslagen assignment-data.

## Gewenste editor-widget

Voeg in `renderField(schema, key, opts)` een branch toe vóór de algemene `type === 'object'`-branch:

1. Herken `schema.format === 'learning-tool-config-url'` en valideer dat `schema['x-config-url'].url` een geldige editor-URL bevat.
2. Render een iframe met een eigen verwijzing naar het propertyveld. Gebruik `width` en `height` als gewenste pixelafmetingen; maak de iframe responsief binnen de modal.
3. Houd per widget een verborgen JSON-waarde bij. Initialiseert die vanuit `opts.defaultValue` (object), of met `{}` als er nog geen configuratie is.
4. Bij een ontvangen waarde: accepteer alleen een plain JSON-object, encodeer die als string in het verborgen veld en markeer het widgetveld als gewijzigd. Houd in `extractValue()` de returnwaarde een JavaScript-object, zodat de bestaande save-payload JSON netjes één niveau diep encodeert.
5. Bij bewerken moet de al opgeslagen propertywaarde vanuit `defaultDataRaw` terug naar dezelfde editor-iframe gaan. Een nieuwe configuratie moet ook geopend en opgeslagen kunnen worden zonder voorafgaande waarde.
6. Geef ontbrekende URL, mislukte iframe-load, ongeldige JSON of een bericht met een niet-objectwaarde een veldgebonden foutmelding die via de bestaande `errorsEl`-validatiestroom zichtbaar wordt.

Gebruik de bestaande `validateField()`-stroom om required-velden te respecteren en controleer de ontvangen waarde ten minste tegen de onderliggende schema-structuur (object, `required`, `properties`, arrays/`items` en relevante grenzen). Als de huidige validatiehelpers hiervoor onvoldoende zijn, voeg een kleine schema-waardev validator toe in `admin.js`; introduceer geen tweede los formulier of savepad.

## URL-resolutie en iframe-beveiliging

De schema-URL wordt door Courses via `/learning-tools-proxy` geladen. De relatieve waarde van `x-config-url.url` moet daarom als iframe-URL worden opgelost ten opzichte van de **concrete Learning Tools `launchUrl`**, niet ten opzichte van de Courses-origin of het proxy-pad. Registry-`launchUrl`s kunnen absoluut zijn; controleer hoe custom/ontwikkeltools in de actuele code worden herschreven.

Voeg de Courses-origin toe als `parentOrigin`-queryparameter op de config-URL met de `URL` API, zodat bestaande queryparameters zoals `mode=config` behouden blijven. De config-tool gebruikt die origin als exact `targetOrigin`.

De afgesproken berichtcontracten zijn:

```js
// Courses -> de bijbehorende config-iframe, na de load-event
{ type: 'learning-tool:config-init', value: {/* eerder opgeslagen JSON-object */} }

// config-iframe -> Courses bij initialisatie en iedere configuratiewijziging
{ type: 'learning-tool:config-change', value: {/* actuele JSON-configuratie */} }
```

Courses moet bij ieder ontvangen bericht alle volgende zaken controleren:

- `event.source === configIframe.contentWindow` voor precies die widget;
- `event.origin === new URL(configIframe.src).origin`;
- `event.data.type === schema['x-config-url'].messageType`;
- `event.data.value` is een begrensd, plain JSON-object dat aan de schema-structuur voldoet.

Gebruik geen `'*'` als `targetOrigin`. Laat een config-iframe van een array-item alleen het verborgen veld van datzelfde array-item bijwerken. Een globale `message`-listener kan dit doen met een `WeakMap` van `contentWindow` naar widgetstate, of met equivalent scoped beheer. Een bericht van een sibling-iframe mag nooit in de verkeerde arrayrij terechtkomen.

## Opslag en gewone toolweergave

Sla de editorwaarde op als de objectwaarde van de schema-property, bijvoorbeeld:

```json
{
  "configuratie": {
    "canvasWidth": 1000,
    "canvasHeight": 620,
    "components": [],
    "wires": []
  },
  "unique_id": "..."
}
```

Gebruik de bestaande `doLearnToolSave()`-route en `data_url`. Er is geen nieuw endpoint nodig: de bestaande Twig `learn_tool()`-functie geeft die assignment-JSON al via `data=<url>` door aan de gewone toolweergave. De configuratie-URL opent alleen in de admin-configuratie-widget; studentweergave blijft de normale `launchUrl` gebruiken.

Bij config-properties binnen schema-arrays krijgt elk object-item een eigen editor-iframe en eigen objectwaarde. Verwijderen of toevoegen van een array-item mag de waarden van de andere editors niet herschikken of overschrijven.

## Acceptatiecontrole

- Het bestaande schemaformulier voor gewone string-, object- en arrayvelden blijft werken.
- De Breadboard-configuratie toont de URL op de Learning Tools-host, met `mode=config`, gewenste hoogte/breedte en `parentOrigin`.
- Een nieuwe Breadboard-editor ontvangt initiële data; wijzigen stuurt JSON terug en vult alleen het bijbehorende verborgen veld.
- Opslaan maakt JSON met `configuratie` als object, niet als JSON-string. Sluit en heropen de modal; de configuratie is hersteld.
- De gegenereerde `learn_tool(...)`-snippet en normale data-URL blijven intact; de studentweergave ontvangt de bewaarde configuratie.
- Een array met minstens twee config-URL-items houdt de iframewaarden gescheiden bij wijzigen, verwijderen, opslaan en opnieuw openen.
- Berichten van een verkeerde origin, een verkeerde iframe/source, onbekend type of onjuist payload-formaat worden genegeerd of als veldfout getoond.
- Werk `public_html/js/admin.min.js` bij met `npm run build:admin-js` als die bundle in de huidige `edit.twig` gebruikt wordt. Voer `node --check public_html/js/admin.js`, relevante bestaande checks en `git diff --check` uit.
- Controleer de echte admin-modal en de normale studentweergave in een browser; syntax- en schema-checks bewijzen de iframe-communicatie en persistente reopen-flow niet.

## Afbakening

Werk in de Courses-repository en wijzig daar alleen de schema-formulierwidget, de message-router/validatie en eventueel de bijbehorende tests en geminificeerde bundle. Verander de Learning Tools-schema’s of Breadboard-runtime niet om Courses te omzeilen. Lees bij het starten de actuele repositoryrichtlijnen en controleer eerst de werkboom; dit document beschrijft de codepaden zoals aangetroffen bij het opstellen en kan verouderen.
