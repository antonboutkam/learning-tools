# Timeline v1

De timeline tool toont een tijdlijn tussen een `startDate` en `endDate` met een lijst van `events`. Je gebruikt deze tool wanneer je chronologie, projectfasen, historische momenten of planningen visueel wilt uitzetten.

## Bestanden
- `index.html`: shell van de tool
- `app.js`: renderlogica en layoutgedrag
- `schema.json`: data-contract voor Courses / builders
- `example.json`: minimale werkende voorbeeldconfiguratie

## Vereiste root-velden
- `unique_id`: stabiele unieke sleutel voor de instance
- `title`: titel boven de tijdlijn
- `direction`: `links-naar-rechts` of `boven-naar-beneden`
- `scale`: bijvoorbeeld `dag`, `maand`, `jaar` of `kwartaal`
- `startDate`: begin van de tijdlijn
- `endDate`: einde van de tijdlijn
- `events`: lijst met momenten

## Optionele root-velden
- `intro`: korte uitleg boven de tijdlijn
- `yearCuts`: komma-gescheiden jaren of jaar-ranges die uit de as geknipt worden
- `phases`: optionele gekleurde faseblokken met label, start- en einddatum
- `viewport.minWidthPx`: handig voor brede horizontale tijdlijnen
- `viewport.minHeightPx`: handig voor lange verticale tijdlijnen; de tool vergroot verticale tijdlijnen daarnaast zelf verder als cards anders zouden botsen

## Event-velden
Per event zijn dit de belangrijkste velden:
- `date`: datum of datetime van het moment
- `title`: korte titel
- `subtitle`: extra contextregel
- `description`: langere uitleg
- `placement`: positie van de card ten opzichte van de as
- `cardStyle`: optioneel kleurpalet voor kaart, rand, tekst en marker
- `imageUrl`: optionele afbeelding in de card
- `linkUrl`: maakt de card klikbaar; opent in een nieuw tabblad

## Phase-velden
Per phase gebruik je:
- `label`: korte naam van de fase
- `startDate`: begin van de fase
- `endDate`: einde van de fase
- `description`: optionele tooltip/uitleg
- `color`: optionele CSS-kleur voor de faseband
- `textColor`: optionele CSS-kleur voor het label

## Placement en direction
`placement` hangt af van `direction`:

- Bij `links-naar-rechts` gebruik je `boven`, `onder` of `auto`.
- Bij `boven-naar-beneden` gebruik je `links`, `rechts` of `auto`.

Gebruik `auto` als je de layout-engine zelf de beste spreiding wilt laten kiezen. Als je twee duidelijke sporen hebt, is vaste plaatsing (`links`/`rechts` of `boven`/`onder`) meestal rustiger.

## Kaartkleuren
Voor `cardStyle` kun je nu kiezen uit vier pastelpaletten:
- `salie-groen`
- `licht-blauw`
- `zacht-perzik`
- `poeder-roze`

De tool past daarmee in één keer de achtergrond, rand, marker en tekstkleuren van het event aan.

## Praktische tips
- Gebruik voor lesplanningen meestal `boven-naar-beneden` met `scale: maand` of `scale: week`-achtige intervallen zoals `dag` of `maand`, afhankelijk van de dichtheid.
- Laat een semesterplanning gerust op maandgrenzen starten/eindigen, ook als het eerste event later in de maand valt; dat geeft meer visuele ademruimte.
- Gebruik `viewport.minHeightPx` zodra je veel events op een verticale tijdlijn zet. De tool trekt verticale clusters nu ook automatisch verder uit elkaar om overlap te beperken.
- Gebruik `phases` voor semesterfasen, projectfases of hoofdstukblokken; de fasebanden blijven achter de as en de cards liggen.
- Gebruik `cardStyle` als je verschillende sporen of categorieen direct visueel uit elkaar wilt trekken zonder extra legenda in de tekst.
- Zet `linkUrl` op course- of bronpagina's als de timeline ook als navigatie moet werken.
- Gebruik `yearCuts` alleen bij lange historische tijdlijnen; voor compacte onderwijsplanningen is het meestal niet nodig.

## Voorbeeld use-cases
- projectlijn + ondersteunende lessen in een semesterplanning
- leerlijn met fases zoals oriëntatie, prototype, integratie en oplevering
- historische tijdlijn met bronnen per moment
- roadmap van concept naar prototype naar oplevering
- chronologische uitleg van een proces of methode
