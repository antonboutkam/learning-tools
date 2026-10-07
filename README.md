# Learning Tools

## Tooldocumentatie

Per toolversie is agentgerichte documentatie beschikbaar in [`docs/tools/README.md`](docs/tools/README.md). De bewerkbare catalogus bevat standaard **Toepassingen**, **Features**, **Implementatie**, **Configuratie** en **API**; `node scripts/build-tool-docs.mjs` genereert daarvan Markdown per versie en een geaggregeerde JSON-index voor toepassingen.

Standalone, versie‑gebaseerde quiz‑types die via iframes in Canvas kunnen worden ingeladen. Elk type heeft een `schema.json` voor formulier‑generatie en een `example.json` voor snelle preview.

## Inhoud
- Centrale registry: `public_html/types/registry.json`
- Overzichtspagina: `public_html/index.php`
- Prompt‑instructies voor Courses: `COURSES_PROMPT.md`
- Docs: `docs/`
- Examples: `docs/examples/`

## Beschikbare tools (quiz‑types)
- Checklist (v1)
  - Pad: `public_html/types/checklist/v1/`
  - Data-schema: `public_html/types/checklist/v1/schema.json`
  - Example: `public_html/types/checklist/v1/example.json`
  - Extra: optionele titel, items met `label`, `checked` en optionele `url` (tekstveld; het label wordt een link). Instellingen: `rememberState`, `allowExport`, `allowAddition`, `allowDeletion`, `checkboxPosition` (`left`/`right`) en `showLabel` (checklisttitel tonen). Tekst blijft links uitgelijnd.
  - `readOnly: true` schakelt vinkjes wijzigen, toevoegen, verwijderen en resetten uit. Links en toegestane export blijven beschikbaar; opgeslagen status wordt alleen gelezen. Standaard staat `readOnly` uit.
  - Lokale opslag bewaart de volledige lijst per `unique_id` (of data-URL); Reset herstelt de startitems en wist de opslag. Export bevat de actuele titel, vinkjes en links als Markdown, tekst of JSON. Gewijzigde startitems beginnen met een nieuwe state.

- Goed of fout (v1)
  - Pad: `public_html/types/goed-of-fout/v1/`
  - Data-schema: `public_html/types/goed-of-fout/v1/schema.json`
  - Example: `public_html/types/goed-of-fout/v1/example.json`
  - Extra: beeldsituaties met optionele vragen, groene en rode antwoordknop, instelbare randomisatie, aantal vragen en slagingsgrens, plus een feestelijke procentuele eindscore en herkansing

- Juiste volgorde (v1)
  - Pad: `public_html/types/juiste-volgorde/v1/`
  - Data‑schema: `public_html/types/juiste-volgorde/v1/schema.json`
  - Example: `public_html/types/juiste-volgorde/v1/example.json`

- Kies de juiste afbeelding (v1)
  - Pad: `public_html/types/kies-de-juiste-afbeelding/v1/`
  - Data‑schema: `public_html/types/kies-de-juiste-afbeelding/v1/schema.json`
  - Example: `public_html/types/kies-de-juiste-afbeelding/v1/example.json`
  - Extra: selecteer meerdere afbeeldingen, markeer per afbeelding `juist`, kies foutafhandeling (`opnieuw-proberen` met countdown en shuffle, of `toon-juiste-antwoord`) en stel `afbeeldingenPerRij` in

- Wat hoort bij wat (v1)
  - Pad: `public_html/types/wat-hoort-bij-wat/v1/`
  - Data‑schema: `public_html/types/wat-hoort-bij-wat/v1/schema.json`
  - Example: `public_html/types/wat-hoort-bij-wat/v1/example.json`
  - Extra: ondersteunt configureerbare `title` + `description` (uitleg), shuffle van rechter- en linkerkolom, en afleiders in de rechterkolom via een `pairs` item met alleen `right` (zonder `left`)

- Pubquiz yes/no (v1)
  - Pad: `public_html/types/pubquiz-yes-no/v1/`
  - Data‑schema: `public_html/types/pubquiz-yes-no/v1/schema.json`
  - Example: `public_html/types/pubquiz-yes-no/v1/example.json`

- Digitaal bericht (C64) (v1)
  - Pad: `public_html/types/digitaal-bericht/v1/`
  - Data‑schema: `public_html/types/digitaal-bericht/v1/schema.json`
  - Example: `public_html/types/digitaal-bericht/v1/example.json`

- Digitaal bericht — toekomst (v2)
  - Pad: `public_html/types/digitaal-bericht/v2/`
  - Data-schema: `public_html/types/digitaal-bericht/v2/schema.json`
  - Example: `public_html/types/digitaal-bericht/v2/example.json`
  - Kale terminal met `$` op iedere schermregel, herstelde tikfouten en tijdelijke puntjes. Geen afzenderblok of knoppen. Het scherm scrollt binnen de vaste iframehoogte. Bij verminderde beweging verschijnt de hele tekst direct.
  - Ondersteunt de bestaande tekstvelden en pipe/backspace-notatie. V1 blijft beschikbaar met de C64-weergave. De nieuwe registry-id is `digitaal-bericht-v2`, zodat beide versies apart te kiezen zijn.

- Strip ballonnetjes (v1)
  - Pad: `public_html/types/strip-ballonnetjes/v1/`
  - Data‑schema: `public_html/types/strip-ballonnetjes/v1/schema.json`
  - Example: `public_html/types/strip-ballonnetjes/v1/example.json`
  - Ondersteunt spraakballonnen met een puntig staartje, gedachteballonnen als wolkje en vraagballonnen met een opgeslagen antwoordveld.
  - Gebruik bij een vraag een variabelenaam zoals `naam`; plaats het antwoord daarna met `{{naam}}` in teksten op vervolgpagina’s.

- Notities (v1)
  - Pad: `public_html/types/notities/v1/`
  - Data‑schema: `public_html/types/notities/v1/schema.json`
  - Example: `public_html/types/notities/v1/example.json`
  - Markdownopmaakbalk in typmodus: vet, cursief, doorhalen, H1/H2/H3, opsommingen, genummerde lijsten, takenlijsten, citaat, link, inline code, codeblok en scheidingslijn. Selecteer tekst of regels en kies de opmaak; Ctrl/Cmd+B en Ctrl/Cmd+I werken ook. De editor toont de Markdownsyntax en slaat deze automatisch op.
  - Downloadmenu: JSON, één Markdown-bestand, Markdown per tabblad (bookmarksectie) in ZIP en plain tekst. Notities vóór het eerste tabblad krijgen een eigen bestand. Alleen pagina’s met inhoud worden opgenomen in de tekstformaten; lege tabbladen blijven aanwezig.
  - JSON bewaart tekst en penstreken. Markdown enkel bevat ingebedde PNG-afbeeldingen (ondersteuning verschilt per Markdown-viewer); de ZIP bevat losse PNG-afbeeldingen met relatieve links. TXT vermeldt waar pentekeningen staan.

- Timeline (v1)
  - Pad: `public_html/types/timeline/v1/`
  - Data‑schema: `public_html/types/timeline/v1/schema.json`
  - Example: `public_html/types/timeline/v1/example.json`
  - Docs: `public_html/types/timeline/v1/README.md`
  - Extra: horizontale of verticale tijdlijn, `placement` hangt af van `direction`, optionele `phases`, optionele `yearCuts`, kaartkleuren via `cardStyle`, klikbare cards via `linkUrl`, afbeeldingen via `imageUrl`, extra ruimte via `viewport.minWidthPx` / `viewport.minHeightPx` en automatische extra spreiding voor verticale clusters

- Lesklok (v1)
  - Pad: `public_html/types/lesson-clock/v1/`
  - Data-schema: `public_html/types/lesson-clock/v1/schema.json`
  - Example: `public_html/types/lesson-clock/v1/example.json`
  - Extra: meerdere lessen met ISO 8601-start- en eindtijdstippen, synchroon aftellen in iedere iframe, pie-weergave, rode waarschuwingsfase, instelbare flitsfrequentie en responsieve weergave voor verschillende iframe-afmetingen

- Bin/Hex/Dec Reken (v1)
  - Pad: `public_html/types/bin-hex-dec-reken/v1/`
  - Data‑schema: `public_html/types/bin-hex-dec-reken/v1/schema.json`
  - Example: `public_html/types/bin-hex-dec-reken/v1/example.json`

- Markdown editor (v1)
  - Pad: `public_html/types/markdown-editor/v1/`
  - Data‑schema: `public_html/types/markdown-editor/v1/schema.json`
  - Example: `public_html/types/markdown-editor/v1/example.json`

- p5.js editor (v1)
  - Pad: `public_html/types/p5-editor/v1/`
  - Data-schema: `public_html/types/p5-editor/v1/schema.json`
  - Example: `public_html/types/p5-editor/v1/example.json`
  - Extra: configureerbare `demoJavaScript`, lokale opslag per `unique_id`, automatisch of handmatig uitvoeren en een geneste preview-iframe met alleen `allow-scripts`, opaque origin en een netwerkblokkerende CSP

- Scrumboard (v1)
  - Pad: `public_html/types/scrumboard/v1/`
  - Data‑schema: `public_html/types/scrumboard/v1/schema.json`
  - Example: `public_html/types/scrumboard/v1/example.json`
  - Extra: configureerbare kolommen, standaard ingeklapte geeltjes met optionele punten, optioneel studenten-items toevoegen/verwijderen, maximale breedte en persistente opslag per `key`

- Mindmap (v1)
  - Pad: `public_html/types/mindmap/v1/`
  - Data‑schema: `public_html/types/mindmap/v1/schema.json`
  - Example: `public_html/types/mindmap/v1/example.json`
  - Extra: verplaatsbare woorden, beperkte kleurset per node, licht/donker thema, meerdere lijnstijlen (`lijn`, `pijl`, `stippellijn`, `veel`, `veel-op-veel`), dropdown-gestuurde verbindingen en frontend-bewerkmodus via `readOnly: false`

- Code in volgorde zetten (v1)
  - Pad: `public_html/types/code-in-volgorde-zetten/v1/`
  - Data‑schema: `public_html/types/code-in-volgorde-zetten/v1/schema.json`
  - Example: `public_html/types/code-in-volgorde-zetten/v1/example.json`
  - Extra: gebruik `regels[].positie` voor de juiste volgorde; laat `positie` leeg voor afleiders

- QR team with role divide (v1)
  - Pad: `public_html/types/qr-team-with-role-divide/v1/`
  - Data‑schema: `public_html/types/qr-team-with-role-divide/v1/schema.json`
  - Example: `public_html/types/qr-team-with-role-divide/v1/example.json`
  - Extra: `planar-type` met QR-join, live teamindeling, rolrotatie per ronde, countdowns en optionele audio/video-opname met teamconsent

- Jargonwoorden presenteren (v1)
  - Pad: `public_html/types/jargonwoorden-presenteren/v1/`
  - Data-schema: `public_html/types/jargonwoorden-presenteren/v1/schema.json`
  - Example: `public_html/types/jargonwoorden-presenteren/v1/example.json`
  - Extra: `canvas_course_view` (`teacher`, `student`, `presentation`) en `canvas_course_mode` (`individual`, `plenary`, `hybrid`), server-side docentclaim per instance, automatische woordverdeling, late instroom, onderzoeks- en spreektimers, presentatie-roulette, stemmen, scorebord en naamopslag

- Poll & vote (v1)
  - Pad: `public_html/types/poll-vote/v1/`
  - Data-schema: `public_html/types/poll-vote/v1/schema.json`
  - Example: `public_html/types/poll-vote/v1/example.json`
  - Extra: live meerkeuzepoll met `canvas_course_view` (`teacher`, `student`, `presentation`), meerdere instelbare vragen, lange antwoordtekst vóór de eerste stem, korte labels in de kleurrijke staafgrafiek en docentbeheer per stem

- Slide-show (v1)
  - Pad: `public_html/types/slide-show/v1/`
  - Data-schema: `public_html/types/slide-show/v1/schema.json`
  - Example: `public_html/types/slide-show/v1/example.json`
  - Extra: `planar-type` met een algemeen interval, optionele `duur` per slide, meerdere getimede en vrij positioneerbare teksten per slide, vier lettertypen, in- en uit-effecten, loop, automatisch starten en voortgang als bullets, nummers of geen

- FutureMe escaperoom (v1)
  - Pad: `public_html/types/escaperoom-futureme/v1/`
  - Data-schema: `public_html/types/escaperoom-futureme/v1/schema.json`
  - Example: `public_html/types/escaperoom-futureme/v1/example.json`
  - Extra: headless fullscreen iframe-layout zonder zichtbare escaperoomheader of intro; vijf ingebouwde themes (`future-message`, `midnight-terminal`, `paper-case`, `signal-green`, `sunset-arcade`) plus eigen kleuren via een `theme`-object; optionele voortgangsbalk boven/onder en resetknop met opschrift `voortgang resetten`; configureerbare kamers met bronstukken, clues, order/match/classify/text/checklist-taken, maximaal drie hints, herstel zonder voortgangsverlies en lokale opslag per `unique_id`. De docentchecklist is zichtbaar maar geen verborgen automatische beoordeling.

## Voorbeeld URL’s (zonder integratie)
Gebruik de demo’s direct in de browser:
- `/types/checklist/v1/?unique_id=demo-checklist-1&data=example.json`
- `/types/goed-of-fout/v1/?unique_id=demo-goed-of-fout-1&data=example.json`
- `/types/juiste-volgorde/v1/?unique_id=demo-volgorde-1&data=example.json`
- `/types/kies-de-juiste-afbeelding/v1/?unique_id=demo-afbeelding-1&data=example.json`
- `/types/wat-hoort-bij-wat/v1/?unique_id=demo-koppelen-1&data=example.json`
- `/types/pubquiz-yes-no/v1/?unique_id=demo-pubquiz-1&data=example.json`
- `/types/digitaal-bericht/v1/?unique_id=demo-bericht-1&data=example.json`
- `/types/strip-ballonnetjes/v1/?unique_id=demo-strip-1&data=example.json`
- `/types/notities/v1/?notitieblok_id=demo-notities-1&data=example.json`
- `/types/timeline/v1/?unique_id=demo-timeline-1&data=example.json`
- `/types/lesson-clock/v1/?data=example.json`
- `/types/bin-hex-dec-reken/v1/?unique_id=demo-bin-hex-dec-1&data=example.json`
- `/types/markdown-editor/v1/?unique_id=demo-markdown-editor-1&data=example.json`
- `/types/p5-editor/v1/?unique_id=demo-p5-editor-1&data=example.json`
- `/types/scrumboard/v1/?key=demo-scrumboard-1&data=example.json`
- `/types/mindmap/v1/?unique_id=demo-mindmap-1&data=example.json`
- `/types/code-in-volgorde-zetten/v1/?unique_id=demo-code-volgorde-1&data=example.json`
- `/types/qr-team-with-role-divide/v1/?unique_id=demo-qr-team-1&data=example.json`
- `/types/jargonwoorden-presenteren/v1/?canvas_course_view=teacher&canvas_course_mode=plenary&unique_id=demo-jargon-1&data=example.json`
- `/types/poll-vote/v1/?canvas_course_view=teacher&canvas_course_mode=plenary&unique_id=demo-poll-1&data=example.json`
- `/types/slide-show/v1/?unique_id=demo-slide-show-1&data=example.json`
- `/types/escaperoom-futureme/v1/?unique_id=demo-futureme-1&data=example.json`
- `/types/breadboard/v1/?unique_id=demo-breadboard-1&data=example.json`

## LTI test-laag (course-level, zonder admin/developer key)
Per tool is een vaste teststructuur toegevoegd:
- Launch endpoint: `/types/<tool-slug>/v1/lti/launch/`
- XML config endpoint: `/types/<tool-slug>/v1/lti/config/?privacy_level=public|name_only|anonymous`
- Lokale mock data: `/types/<tool-slug>/v1/lti/mock-data.json`
- Productie data-override in XML: `/types/<tool-slug>/v1/lti/config/?privacy_level=public&data=<urlencode(json-url)>`

Daarnaast is er een algemene debugpagina:
- `/lti-debug/`

Doel: snel testen welke launch-velden Canvas doorgeeft en of course-level External Tool by URL/XML werkt.

## Docs
- Prompt‑instructies: `COURSES_PROMPT.md`
- Registry + schema contract: `public_html/types/registry.json`
- Courses config-URL datatype en iframe-berichtcontract: `docs/config-url-fields.md`
- LTI inzendingen (Canvas): `docs/lti-submission.md`
- LTI config voorbeeld: `docs/lti-config-example.json`
- LTI test URL matrix + smoke-tests: `docs/lti-test-urls.md`
- Overzicht examples: `docs/examples/README.md`

## Docs/examples
- `docs/examples/juiste-volgorde.v1.example.json`
- `docs/examples/wat-hoort-bij-wat.v1.example.json`
- `docs/examples/pubquiz-yes-no.v1.example.json`
De breadboardeditor ondersteunt nu ook directe montage: sleep een componentpin naar een breadboardgat om de positie vast te klikken en de elektrische verbinding zonder losse draad op te slaan. Verplaatsen, draaien of handmatig positioneren maakt die montage weer los. Positieve en negatieve voedingspinnen zijn respectievelijk rood en blauw; een pasteltint betekent niet aangesloten en een felle tint betekent fysiek aangesloten. Met de globale checkbox in het Stage-paneel kunnen de contactrondjes in het eindresultaat worden verborgen, terwijl ze in de editor zichtbaar blijven. Breadboards staan standaard onder andere componenten; via **Bovenaan plaatsen** in het rechtermuisknopmenu kan ieder onderdeel naar de hoogste componentlaag worden gebracht. De Stage-lijst toont de werkelijke laagvolgorde van hoog naar laag en kan via de sleephandgrepen opnieuw worden gerangschikt. Tijdens het slepen op het canvas staat het actieve onderdeel tijdelijk boven alle andere onderdelen, zonder de opgeslagen laagvolgorde te wijzigen. Knikpunten staan altijd één visuele laag boven de draden. **Opslaan als afbeelding** exporteert de stage in de editor als PNG; een globale checkbox bepaalt of dezelfde knop ook in de weergavemodus beschikbaar is.

- Breadboard configurator en voorbeeld: `public_html/types/breadboard/v1/`. Na een klik op de eerste pin volgt een tijdelijke draad de aanwijzer en klikt die binnen 10 pixels vast op een pin. Draden liggen zichtbaar boven de pinnen. Een enkele klik selecteert een draad; een dubbelklik voegt op dat segment een knikpunt toe. Alle draden staan in het Stage-paneel en kunnen daar een naam of label krijgen. Klik op het kleuricoon van een draad om direct een kleur uit het palet te kiezen; de vrije kleurkiezer bij de geselecteerde draad blijft beschikbaar. Verplaats knikpunten met slepen; ze lijnen horizontaal en verticaal uit op andere knikpunten én op componentconnectors. Klik met de rechtermuisknop op een knikpunt om het via een menu te verwijderen. Een klik op het lege canvas voegt geen draadpunten toe. De pinnaam verschijnt onderaan bij aanwijzen; de cursor toont een flits boven pinnen en een draadtip tijdens verbinden. De stage is te verplaatsen door lege ruimte te slepen en te zoomen met een touchpad-knijpbeweging of de verticale +/−-bediening rechtsonder. Klik op een element om het bovenaan in het rechterblok **Stage** te tonen en daar te bewerken; bij hover licht de bijbehorende kaart op. Het rechtermuisknopmenu van een component bevat acties om 90 graden linksom of rechtsom te draaien en om het component te verwijderen; contactpunten en draden draaien mee en gekoppelde draden worden bij verwijderen opgeruimd. Componentkaarten zijn afzonderlijk inklapbaar, de getoonde naam is aanklikbaar om hem te bewerken en verwijderen/vergrendelen gebeurt via compacte iconen. In **Library** kun je Fritzing-onderdelen zoeken en op familie filteren. De secties **Stage** en **Library** zijn inklapbaar en de onderdelenlijst in Library heeft een eigen scrollbalk. Onderdelen voeg je via Library toe; de drie snelknoppen bovenaan zijn verwijderd. De editor haalt één compacte catalogus op, toont maximaal 36 resultaten tegelijk met kleine afbeeldingen en laadt de volledige onderdeeldefinitie en breadboard-SVG pas bij plaatsing. De fysieke `width`- en `height`-eenheden uit de Fritzing breadboard-SVG bepalen daarbij de weergavegrootte, zodat onder meer leds en weerstanden op schaal worden geplaatst. Onderdelen zonder breadboard-SVG zijn zichtbaar maar nog niet plaatsbaar. Werk de catalogus `library.json` na wijzigingen aan de Fritzing-bronbestanden bij met `python3 public_html/types/breadboard/v1/build_library.py`. Ctrl+Z maakt een bewerking ongedaan, Ctrl+Y of Ctrl+Shift+Z voert die opnieuw uit. Ctrl+X knipt een geselecteerd element of een geselecteerde draad; Ctrl+V plakt die binnen de editor terug.

De breadboard-dradenlijst ondersteunt daarnaast inline naambewerking, afzonderlijke knoppen voor selecteren en verwijderen, en optionele draad- en componentlabels op de stage. Via de werkbalk kunnen ook losse, verplaatsbare labels en pijlen als annotaties worden toegevoegd; tekst, posities en kleur zijn in het Stage-paneel aan te passen. Een optionele korte caption verschijnt onder de learn-tool.

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

### Output-specificatie

Een schema kan op rootniveau aangeven welke bestandsformaten de tool kan exporteren via `outputs`. Dit is metadata over de tool en dus geen invoerveld in `properties`:

```json
"outputs": [
  {
    "type": "md",
    "title": "Markdown",
    "description": "De inhoud kan als Markdown-bestand worden gedownload.",
    "mimeType": "text/markdown",
    "extensions": [".md", ".markdown"]
  }
]
```

Gebruik voor automatische compatibiliteitscontrole altijd `outputs[].type` als stabiele extensiecode. `mimeType`, `extensions`, `title` en `description` zijn optionele presentatiemetadata voor toekomstige uitbreidingen. Een lege array (`"outputs": []`) betekent dat de versie momenteel geen bestandsoutput ondersteunt. Gebruik bijvoorbeeld `md`, `json`, `txt` en `pdf` als type-codes; voeg nieuwe codes alleen toe wanneer de tool dat formaat daadwerkelijk kan exporteren.
