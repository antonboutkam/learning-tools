# Werkende feedopdrachten voor drie Courses pagina's

Maak op de drie onderstaande pagina's een werkende positieve én negatieve manipulatieopdracht met `feed-algoritme-handmatig/v1`. Lever de cursuspagina's, zes eigen toolconfiguraties en browsercontroles op. De opdracht is uitvoeren en testen; alleen beoordelen of een iframe plaatsen is onvoldoende.

## Startopdracht voor de Courses agent

> Werk in `/home/anton/Documents/sites/courses`. Lees de actuele `AGENTS.md` en de relevante Courses-protocollen. Controleer de Git-status en behoud bestaande wijzigingen, in het bijzonder het lopende werk aan pagina's 5100 en 5200. Voer `/home/anton/Documents/sites/learning-tools/docs/courses-feed-algoritme-handmatig-implementation.md` uit voor uitsluitend pagina's 4100, 4200 en 4300 en hun nieuwe configuraties. Gebruik per pagina twee instanties van `/types/feed-algoritme-handmatig/v1/`: één positief, één negatief. Hergebruik de oorspronkelijke vier posts en 48 reacties per onderwerp. Bouw de opdrachten met twee feedplaatsen en haalbare doelen boven +200 en onder −200. Controleer de echte studentpagina's in de browser en lever aantoonbaar haalbare resultaten op. Los de hieronder beschreven `unique_id`-compatibiliteit met een kleine wijziging aan het Learning Tools-schema op. Verricht geen productiepublicatie of Canvas-push zonder daarvoor bestaande autorisatie.

## Pagina's en bronmateriaal

Behoud de bestandsnamen en page-UID's. Controleer eventuele actuele pagina-instellingen en relaties voordat je schrijft.

| Pagina onder `courses/digitale-vaardigheden-11/` | Onderwerpcode | Voorstel waarop positief en negatief betrekking hebben | Oorspronkelijke posts |
| --- | --- | --- | --- |
| `4100-ordenen-asiel-en-wonen.d1100015.twig` | `asiel_wonen` | Opvang combineren met extra betaalbare woningbouw | `post_05` t/m `post_08` |
| `4200-ordenen-genderverhoudingen.d1100016.twig` | `gender_verhoudingen` | Ongelijkheid en traditionele genderverwachtingen verminderen | `post_13` t/m `post_16` |
| `4300-ordenen-klimaat.d1100017.twig` | `klimaat` | Klimaatmaatregelen sneller invoeren | `post_17` t/m `post_20` |

De authoringbron is `courses/digitale-vaardigheden-11/assets/file/feed-bron.json`. Gebruik die voor inhoud, IDs, auteurs, datums en `stance`. De huidige `assets/learn-tool/assignment-data/opdracht3-feed.json` en `docs/organization/dv11-herinrichting/data/generate.py` laten de bestaande beeldkoppeling en alternatieve teksten zien. Controleer de actuele bron bij uitvoering.

Laat de oorspronkelijke bron en de bestaande Feedlab-configuraties intact. Iedere nieuwe configuratie bevat uitsluitend het eigen onderwerp: vier posts en alle 48 oorspronkelijke reacties, met twaalf reacties bij hun oorspronkelijke post. Behoud teksten, IDs en onderlinge koppelingen exact. Kopieer alleen velden die in het nieuwe schema bestaan.

## Eerst de toolkoppeling controleren

Lees in `/home/anton/Documents/sites/learning-tools/` de actuele registry en deze bestanden:

- `public_html/types/feed-algoritme-handmatig/v1/schema.json`
- `public_html/types/feed-algoritme-handmatig/v1/example.json`
- `public_html/types/feed-algoritme-handmatig/v1/app.js`
- `public_html/types/feed-algoritme-handmatig/v1/runtime.test.cjs`

De tool laadt JSON via `?data=<URL>`. Courses geeft deze parameter al door via `learn_tool()`. Gebruik daarom de bestaande helper en `/learn-tool/<course>/assignment-data/<bestand>.json`.

Er is een concrete schema-afstemming nodig: `modules/LearnTool/LearnToolDataController.php` verwacht een geldige `unique_id` in assignment-JSON. Ontbreekt deze, dan kan een GET een willekeurig ID toevoegen en het bronbestand herschrijven. Het nieuwe toolschema stond bij het schrijven van deze overdracht op `additionalProperties: false` zonder `unique_id`-property.

Los dit vooraf op door aan het nieuwe toolschema een **optionele** `unique_id`-property toe te voegen, als deze nog ontbreekt:

```json
{
  "title": "Unieke opdrachtcode",
  "description": "Stabiele identificatie van deze toolinstantie in Courses.",
  "type": "string",
  "pattern": "^[a-zA-Z0-9-]{8,64}$"
}
```

Dit is de enige vooraf voorziene wijziging aan de Learning Tools-codebasis: het schema accepteert Courses-metadata; de runtime gebruikt het veld niet voor opslag. Houd `additionalProperties: false`. Vul de zes JSON-bestanden meteen met een eigen stabiele `unique_id` en geef dezelfde waarde in de Twig-opties mee. Controleer dat het data-endpoint de bestanden daarna niet verandert. Pas de algemene Courses-controller niet aan om dit ene type te omzeilen.

## Zes configuraties en een reproduceerbare omzetting

Maak in `courses/digitale-vaardigheden-11/assets/learn-tool/assignment-data/`:

- `manual-asiel_wonen-positief.json` en `manual-asiel_wonen-negatief.json`
- `manual-gender_verhoudingen-positief.json` en `manual-gender_verhoudingen-negatief.json`
- `manual-klimaat-positief.json` en `manual-klimaat-negatief.json`

Gebruik als instantiecode `dv11-manual-<onderwerp-met-koppeltekens>-<richting>`, bijvoorbeeld `dv11-manual-asiel-wonen-positief`. Dit zijn nieuwe instanties; verander de bestaande IDs van andere tools niet.

Leg de omzetting vast in een klein, afzonderlijk script onder `docs/organization/dv11-herinrichting/data/`, bijvoorbeeld `generate_manual_feed.py`. Geef het een read-only `--check` die ontbrekende of afwijkende nieuwe configuraties rapporteert. Laat dit script uitsluitend de zes nieuwe configuraties beheren. De bestaande `generate.py`, zijn manifest en oude ordenconfiguraties hoeven hiervoor niet te worden vervangen.

Vul ieder bestand volgens het actuele schema:

| Veld | Waarde of omzetting |
| --- | --- |
| `source_format` | `feed-algoritme-handmatig-v1` |
| `unique_id` | De eigen stabiele instantiecode |
| `title` | `Stuur de beeldvorming — <onderwerp> — <richting>` |
| `instruction_title` | `Maak het beeld zo positief mogelijk` of `Maak het beeld zo negatief mogelijk` |
| `instruction_text` | Eigen opdrachttekst volgens het volgende onderdeel |
| `feed_post_limit` | `2` |
| `target` positief | `{"comparison": "more_than", "score": 200}` |
| `target` negatief | `{"comparison": "less_than", "score": -200}` |
| `posts[].id`, `author_name`, `headline`, `body`, `published_at` | Overnemen uit de oorspronkelijke post |
| `posts[].topic` | Leesbare titel van het onderwerp |
| `posts[].image` | Bestaande onderwerpafbeelding met beschrijvende `alt`, opgelost voor de doelomgeving |
| `posts[].image_correction` | `round(90 * oorspronkelijke_post.stance)` |
| `comments[].id`, `post_id`, `author_name`, `body` | Overnemen uit de oorspronkelijke reactie |
| `comments[].score` | `round(5 * oorspronkelijke_reactie.stance)` |

Gebruik `stance` als richting ten opzichte van het genoemde voorstel. Leid reactiescores niet af uit likes, boosreacties, `vote` of alleen woorden zoals 'eens'. Een reactie die instemt met een kritische post kan juist een negatieve `stance` hebben. Controleer de betekenis in de context van de oorspronkelijke post. Draai de scores niet om voor de negatieve variant: beide varianten gebruiken dezelfde inhoud en dezelfde scorebetekenis.

Zet de posts in beide varianten in een gemengde beginvolgorde: eerste positieve post, eerste negatieve post, tweede positieve post, tweede negatieve post. De eerste twee posts zijn zichtbaar. Per post zijn de eerste vijf beschikbare reacties in bronvolgorde standaard zichtbaar. Bereken de beginstand inclusief die reacties bij zichtbare posts; neem niet aan dat de startscore nul is. De tool toont de berekende stand direct boven de feed en in het uitlegblok. Voeg daarvoor geen ongedocumenteerde velden als `visible`, `shuffle`, `items`, `initial_settings`, `metrics` of `respondent_groups` toe.

Gebruik voor afbeeldingen absolute HTTP(S)-URL's op de juiste Courses-host: een relatief `/img/...`-pad wordt in de iframe anders op de Learning Tools-host gezocht. Laat de generator bijvoorbeeld een expliciete `--asset-origin` gebruiken. Controleer bij productievoorbereiding dat ontwikkelhosts niet achterblijven en dat de zes configuraties hun bedoelde afbeelding kunnen laden.

## Scoredoelen en aantoonbare oplossingen

De huidige bron heeft per onderwerp twee positieve posts en twee negatieve posts, met per post vijf positieve, vijf negatieve en twee neutrale reacties. Met de hierboven gekozen omzetting is per onderwerp het volgende haalbaar:

- Twee positieve posts zonder reacties: `90 + 90 = 180`; certificaat nog niet behaald.
- Die posts met samen vijf positieve reacties: `180 + 5 × 5 = 205`; positief certificaat behaald.
- Twee positieve posts met ieder vijf positieve reacties: `230`; positief maximum.
- Twee negatieve posts met samen vijf negatieve reacties: `−180 − 5 × 5 = −205`; negatief certificaat behaald.
- Twee negatieve posts met ieder vijf negatieve reacties: `−230`; negatief minimum.

Bewijs deze uitkomsten opnieuw vanuit de actuele zes configuraties. Een leerling mag minder dan vijf reacties per post selecteren; vijf is een maximum. De score telt alleen zichtbare posts en de geselecteerde reacties van die posts. Alleen het verwisselen van de volgorde van dezelfde zichtbare posts verandert de score niet: deze tool kent geen positiegewicht.

Gebruik bij deze opzet geen grens van +300 of −300. Twee feedplaatsen kunnen zelfs met maximale toegestane scores maar ±250 opleveren; de voorgestelde inhoud levert ±230. De vergelijkingen zijn strikt: precies `200` of `−200` is onvoldoende voor het bijbehorende doel.

## De opdrachtteksten aanpassen

Vervang de huidige twee instanties van `juiste-volgorde` op iedere pagina door de twee nieuwe instanties. Behoud de gewone coursepagina en de automatische paginatitel; voeg geen tweede H1 toe. Laat de bestaande presentatiestatus en page-UID's intact.

Bouw iedere pagina op rond:

1. Een korte introductie: je maakt twee selecties uit dezelfde bron, één voor een positief en één voor een negatief beeld van het voorstel.
2. De oorspronkelijke genummerde bron met alle reacties, bij voorkeur in een inklapbaar blok. Behoud de bestaande `_snippets/bron-<onderwerp>.twig`-include. Hier kan de student de oorspronkelijke post- en reactie-ID's terugvinden; de nieuwe tool toont die IDs niet standaard.
3. De positieve tool met eigen instructie en de negatieve tool met eigen instructie.
4. Een korte onderbouwing en een manier om beide resultaten te bewaren.

Gebruik voor de eigen positieve instructie bijvoorbeeld:

> Laat de lezer zo positief mogelijk denken over [het voorstel]. Kies twee posts die dit beeld versterken en laat per post maximaal vijf passende reacties zien. Verplaats andere posts onder de rode lijn. Probeer je score zo hoog mogelijk te maken en gebruik daarna Controleer score.

Gebruik voor de negatieve variant dezelfde opdracht met 'negatief' en 'zo laag mogelijk'. Zet gewone tekst in `instruction_text`; de tool rendert deze waarde als tekst, niet als HTML of Markdown. De algemene bedieningsuitleg en de zin met 'meer dan 200' of 'minder dan −200' worden door de tool zelf toegevoegd.

Verwijder verouderde aanwijzingen zoals 'maak twee volgorden van alle vier de posts', 'de onderste twee blijven in de feed' en 'de controleknop staat uit'. De nieuwe opdracht gaat over selecteren, zichtbaarheid en reacties én over de volgorde binnen de selectie.

Laat de student per variant bewaren:

- een screenshot met de score en het resultaat van **Controleer score**, plus de gekozen posts indien die niet op hetzelfde scherm passen;
- de twee gekozen post-ID's en minstens één gebruikte oorspronkelijke reactie-ID;
- een korte uitleg welk beeld wordt versterkt, welke context ontbreekt en waarom de selectie dat effect heeft.

De tool heeft geen resultaat-export, lokale voortgangsopslag of Canvas-scoreterugkoppeling. De leerling bewaart het resultaat voordat de pagina wordt ververst. Noem de onderbouwing en screenshots als inleverproduct; beloof geen download of officiële certificaatregistratie.

Behoud per onderwerp de bestaande nuance dat beeldvorming geen waarheidsscore is en dat de eigen politieke of persoonlijke opvatting niet wordt beoordeeld. Maak duidelijk dat de punten het ontworpen effect binnen fictieve onderwijsdata modelleren. Positief of negatief slaat op het voorstel, niet op de waarde van mensen of groepen. Behoud de verwijzing naar de vervolgoefening op basis van de actuele titel en route; ga daarvoor niet de pagina's 5100 of 5200 herschrijven.

## Voorbeeld van de iframekoppeling

```twig
{{ learn_tool(
    '/types/feed-algoritme-handmatig/v1/',
    '/learn-tool/digitale-vaardigheden-11/assignment-data/manual-asiel_wonen-positief.json',
    {
        height: 1100,
        title: 'Positieve beeldvorming — asiel en wonen',
        unique_id: 'dv11-manual-asiel-wonen-positief'
    }
) }}
```

Maak de negatieve variant en de vier andere instanties met hun eigen bestandsnaam, titel en ID. Controleer in de browser of de hoogte en het scrollen bruikbaar zijn bij uitgeklapte reacties. De brede tool heeft twee kolommen; controleer ook een smaller scherm.

## Controles voor oplevering

Werk de zes configuraties af voordat je het resultaat 'werkende opdrachten' noemt:

1. Valideer alle zes bestanden tegen het actuele draft 2020-12-schema, inclusief de optionele `unique_id`. Controleer unieke post- en reactie-ID's, vier posts, 48 reacties en de oorspronkelijke koppelingen en teksten. Controleer alle scoregrenzen en de gemengde startselectie.
2. Bereken voor elk bestand de startscore inclusief de eerste vijf beschikbare reacties per zichtbare post, een concrete geslaagde selectie met reactie-ID's en minimum/maximum. Bewijs positief haalbaar `205`/`230` en negatief haalbaar `−205`/`−230`. Laat de check ook bewaken dat iedere doelrichting bereikbaar is en aanvankelijk niet behaald wordt. Controleer dat de startscore direct zichtbaar is, zonder de controleknop te gebruiken.
3. Draai de nieuwe generator in `--check`-modus en controleer dat de oorspronkelijke authoringbron en de bestaande Feedlab-artifacts ongewijzigd zijn. Draai passende bestaande coursechecks en Twig-syntaxcontrole. Repareer door jouw wijziging veroorzaakte fouten; meld afzonderlijk eventuele reeds bestaande fouten.
4. Draai `node public_html/types/feed-algoritme-handmatig/v1/runtime.test.cjs` vanuit de Learning Tools-repository en `git diff --check` in de repositories waarin je hebt gewijzigd.
5. Open alle drie de werkelijke routes met `?course_view=student&course_mode=individual`. Controleer per pagina beide iframes, hun eigen opdracht en onderwerp, afbeeldingen en JSON-requests. Voor de routes: gebruik de bestandsnamen uit de tabel zonder `.twig` onder `/course/digitale-vaardigheden-11/`.
6. Test per onderwerp positief én negatief: begin zonder certificaat, haal een passende derde post met drag-and-drop boven de rode lijn en controleer dat de laatste zichtbare post eronder verdwijnt. Test ook de zichtbaarheidsschakelaars en een lagere zichtbare bezetting. De lijn scheidt steeds de zichtbare en onzichtbare posts; twee is de maximale capaciteit.
7. Controleer dat de eerste vijf beschikbare reacties per post aanvankelijk zichtbaar zijn en overige reacties grijs en onzichtbaar zijn. Bij minder dan vijf beschikbare reacties zijn ze allemaal geselecteerd. Controleer dat geselecteerde reacties bovenaan komen en een zesde zichtbare reactie per post wordt geweigerd. Verberg de bijbehorende post en controleer dat ook zijn geselecteerde reacties niet meer meetellen in de totaalscore. De zichtbare stand wordt na iedere wijziging bijgewerkt.
8. Controleer eerst de faalmelding met Controleer score, vervolgens een geslaagde selectie met `205` of `−205`, de certificaatmelding en het effect bij het passeren van de grens. Controleer de strikte vergelijking op de grens zo nodig met een aparte testfixture. Verander hiervoor niet de zes echte opdrachtconfiguraties.
9. Bewaar browserbewijs en vermeld welke routes en varianten zijn getest. Controleer ook de browserconsole en de netwerkrequests op fouten. Syntax- en schemacontroles vervangen deze browsercontrole niet.

Controleer de gekozen doelomgeving apart. Lokale bestanden en een bijgewerkte lokale registry bewijzen niet dat de tool al op `learning-tools.devroc.nl` staat. Als daar nog deployment ontbreekt, lever de lokale opdrachten met hun bewijs op en benoem de benodigde publicatiestap concreet. Rapporteer ze dan niet als werkend op productie.

## Afronding

Lever een overzicht van de drie gewijzigde pagina's, zes configuraties, het nieuwe generator-/controlepad en de kleine schema-aanpassing. Geef per onderwerp de gemeten score-uitkomsten, het browserbewijs en eventuele resterende publicatiestap. Laat de oude `order-*.json`-bestanden bestaan zolang ze geen probleem veroorzaken; deze omzetting geeft geen opdracht tot opschonen van gedeelde artifacts.

Deze overdracht is een uitvoeringsinstructie. De beschreven Courses-wijzigingen zijn bij het schrijven ervan nog niet uitgevoerd.
