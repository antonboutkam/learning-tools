# Config-URL-velden in Courses

Een schema kan een bewerkbare configuratie-iframe declareren met het custom JSON Schema format `learning-tool-config-url`. De schema property is een object dat de JSON-waarde van de configurator opslaat. `x-config-url` bevat de URL van de configuratiepagina en optionele iframe-afmetingen in pixels.

```json
{
  "type": "object",
  "title": "Breadboard-configuratie",
  "description": "Bewaar de tekening die in de editor is gemaakt.",
  "format": "learning-tool-config-url",
  "x-config-url": {
    "url": "/types/breadboard/v1/?mode=config",
    "width": 1120,
    "height": 760,
    "valueType": "application/json",
    "messageType": "learning-tool:config-change"
  },
  "properties": {
    "canvasWidth": { "type": "integer", "title": "Canvasbreedte (px)" },
    "canvasHeight": { "type": "integer", "title": "Canvashoogte (px)" }
  }
}
```

Courses moet voor deze property een iframe tonen op `x-config-url.url` en het veld als JSON-string in een verborgen invoer bewaren. Voeg de origin van de Courses-pagina als `parentOrigin` queryparameter toe aan de editor-URL; de tool gebruikt die als `postMessage`-doelorigin. Na het laden stuurt Courses de huidige JSON-waarde terug naar de iframe. Bij elke wijziging stuurt de tool een bericht naar het parent frame:

```js
{ type: 'learning-tool:config-change', value: { /* JSON-configuratie */ } }
```

Parent-side pseudocode (de element- en opslagnamen aanpassen aan het Courses-formulier):

```js
const frame = document.querySelector('[data-config-frame="breadboard"]');
const hidden = document.querySelector('input[name="configuratie"]');
const toolOrigin = new URL(frame.src).origin;

frame.addEventListener('load', () => {
  let value = {};
  try { value = JSON.parse(hidden.value || '{}'); } catch (_) {}
  frame.contentWindow.postMessage({ type: 'learning-tool:config-init', value }, toolOrigin);
});

window.addEventListener('message', event => {
  if (event.origin !== toolOrigin || event.source !== frame.contentWindow) return;
  if (event.data?.type !== 'learning-tool:config-change') return;
  hidden.value = JSON.stringify(event.data.value);
  hidden.dispatchEvent(new Event('input', { bubbles: true }));
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
});
```

Bij opslag serialiseert Courses de verborgen waarde als de schema-propertywaarde. Bij de gewone toolweergave geeft Courses de opgeslagen JSON mee als `data`-object of via de bestaande `data=<url-naar-json>` launch-conventie. Bij een array met configureerbare items maakt Courses een aparte configuratie-iframe en een eigen verborgen JSON-veld per item; koppel de berichten aan de betreffende iframe en invoer, en valideer altijd zowel `event.origin` als `event.source`.

De custom `format` is UI-metadata voor Courses, geen standaard JSON Schema `type`. Validators blijven de onderliggende `type: object` en diens `properties` controleren. Zonder `x-config-url` kan een consumer het configuratie-iframe niet openen. `width` en `height` zijn gewenste pixelmaten; een responsive consumer mag ze begrenzen aan de beschikbare ruimte.

## Breadboard v1

De editor staat op `/types/breadboard/v1/?mode=config`. De read-only toolweergave gebruikt `/types/breadboard/v1/?data=<urlencode-json-of-config>`. De voorbeeldconfiguratie staat in `public_html/types/breadboard/v1/example.json`. De tool ondersteunt componenten toevoegen, slepen, naam/positie wijzigen, vergrendelen en via het rechtermuisknopmenu in stappen van 90 graden draaien, contactpunten verbinden en draden selecteren, benoemen en kleuren. Een enkele klik selecteert een draad; een dubbelklik voegt een knikpunt toe. Tijdens slepen snapt een knikpunt horizontaal en verticaal naar andere knikpunten van dezelfde draad. Een knikpunt kan worden geselecteerd om zijn X- en Y-positie handmatig in te voeren en is via zijn rechtermuisknopmenu te verwijderen. Fritzing-afbeeldingen, Uno-contactcoördinaten en de interne breadboard/Uno-verbindingen zijn gebaseerd op meegeleverde Fritzing parts.

De configurator toont controleberichten voor ongeldige of dubbele IDs, onbekende draadeindpunten, verkeerde draadkleuren, posities/knikpunten buiten het canvas, niet-aangesloten tweepinscomponenten, overbrugde tweepinscomponenten en een verbinding tussen Arduino 5V en GND. De laatste controles volgen Fritzing's `buses`-metadata voor het breadboard en Arduino Uno. Dit controleert de getekende topologie; het is geen elektrische simulator en controleert bijvoorbeeld geen stroom, weerstand, polariteit van willekeurige onderdelen of compatibiliteit van componenten.
