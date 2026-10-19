# Feedlab v1

Een zelfstandige Nederlandstalige tool om feedselectie te onderzoeken. Dezelfde bronpool kan verschillende algoritmen krijgen. Antwoorden veranderen de rangschikking of groepsindeling niet. De tool ondersteunt berichten, afbeeldingen, geneste reacties, lokale aanvullingen en exports.

Standaardpalet: blauw `#1877F3` voor accenten, donkerblauw `#3B5999` bij hover, achtergrond `#F0F2F5`, witte kaarten `#FFFFFF` en donkere leestekst `#1C1E21`. Ook avatars, onderwerpchips, feedcode en placeholders volgen dit palet. Eigen kleurinstellingen blijven mogelijk.

Posts langer dan 175 tekens worden op een heel woord ingekort, met `...` en **Meer weergeven** om de volledige tekst te lezen. Een eerste woord dat zelf langer is dan 175 tekens blijft intact.

## Fictieve profielfoto’s

De tool bevat twintig AI-gegenereerde portretten van fictieve volwassenen in `avatars/`. Posts en reacties tonen een ronde profielfoto in plaats van initialen. De auteur-ID bepaalt steeds dezelfde foto, ook na sorteren of herladen; meerdere auteurs kunnen dezelfde foto krijgen. De koppeling doet geen uitspraak over het uiterlijk van een echte student. Er worden geen externe fotoverzoeken gedaan. Het bestand `avatars/prompts.json` bevat de gebruikte prompts.

## Starten

Open `index.html` via een webserver. Standaard wordt `example.json` geladen. Gebruik `?data=URL` voor een eigen configuratie. Het instellingenpaneel begint ingeklapt en opent via **Algoritme**. Met `showAlgorithmButton: false` in de toolconfig verberg je deze knop en blijft het paneel dicht. Zonder deze property is de knop zichtbaar. Het kleine label linksonder toont de toegewezen respondentgroep. De feedcode staat bij het onderzoekspaneel. De app laadt `engine.min.js`, `app.min.js` en `style.min.css`.

## Respondentgroepen en automatische toewijzing

Maak onder **Instellingen → Respondentgroepen en standaardalgoritmen** zelf groepen aan. Nieuwe groepen beginnen met de huidige algoritmeregels. Je kunt een groep een andere naam geven, verwijderen en de huidige regels voor de geselecteerde groep bewaren. Selecteren in de keuzelijst bepaalt alleen welke groep je bewerkt; het verandert de feed niet. **Groepsalgoritme laden als lokale preview** probeert de opgeslagen regels uit. Het label en de status vermelden de preview; de oorspronkelijke toewijzing blijft bewaard. **Terug naar toegewezen groep** herstelt de eigen feed en lokaal bewaarde antwoorden.

Bij een eerste bezoek kiest de tool met cryptografische browserrandomness één groep met gelijke kans per groep. Bij twee groepen krijgt elke respondent 50% kans op elke groep: in een klas ontstaat ongeveer een verdeling in twee helften, geen gegarandeerde exacte balans. Bij drie groepen is de kans per groep een derde. Met één groep komt iedereen daarin. Zonder groepen of met een lege lijst gelden de standaardalgoritmeregels.

De toewijzing wordt lokaal opgeslagen op basis van `unique_id`. Herladen, een andere feedcode of een gewijzigde configuratie met hetzelfde ID veranderen de groep niet zolang die nog bestaat. Een verwijderde groep wordt automatisch vervangen door een nieuwe willekeurige beschikbare groep. Wanneer alle groepen verdwijnen geldt de standaardgroep. Een nieuwe groep toevoegen verdeelt bestaande respondenten niet opnieuw. Gebruik voor een nieuw onderzoek een nieuw `unique_id`.

De toewijzing betreft een browserprofiel voor deze dataset. Andere apparaten, andere browserprofielen en gewiste lokale opslag krijgen een nieuwe keuze. De tool vraagt geen naam, nummer, demografie of mening om de groep te bepalen. Er is geen serverregistratie of centrale groepstelling. De groepskeuze hangt niet af van feedcode, antwoorden of inhoudelijke voorkeuren.

**Docentpreview:** met `?group=A` kun je expliciet het algoritme van groep A proberen, eventueel met `&seed=vaste-code`. Dit wijzigt de automatisch bewaarde toewijzing niet; de preview wordt zichtbaar als zodanig benoemd. Bij een ongeldige groepsparameter gebruikt de tool de eigen groep. Deel een previewparameter alleen als die bewuste override de bedoeling is.

## Configuratie

```json
{
  "source_format": "feed-lab-v1",
  "initial_settings": {"postLimit":6},
  "respondent_groups": [
    {"id":"A","label":"Groep A","settings":{"commentStanceBias":1,"weights":{"stance_bias":1}}},
    {"id":"B","label":"Groep B","settings":{"commentStanceBias":-1,"weights":{"stance_bias":-1}}}
  ],
  "showQuestions": false,
  "theme": {"background":"#F0F2F5","card":"#FFFFFF","text":"#1C1E21","accent":"#1877F3"}
}
```

Dit fragment vult de verplichte bronvelden aan: `title`, `unique_id`, `lesson`, `topics`, `posts`, `comments`, `questions`. `example.json` is een complete configuratie met twee respondentgroepen en alle standaardkleuren. `schema.json` gebruikt JSON Schema draft 2020-12, met Nederlandse labels voor groepen en vormgeving. Voor authoringobjecten blijven vrije bestaande bronvelden toegestaan. Instellingen, groepsdefinities, exportcontext en kleuren worden strikt gecontroleerd. De engine valideert ook unieke IDs, graphverwijzingen, geldige datums en afbeeldingen.

Instellingen worden samengevoegd als brondefaults → `initial_settings` → groepsinstellingen, inclusief de afzonderlijke gewichten. Dit zijn standaardalgoritmen; ze vullen geen studentantwoorden in. `showQuestions:false` verbergt het individuele vragenpaneel, terwijl feedcode en groepslabel zichtbaar blijven. Nieuwe configs gebruiken `respondent_groups`. Legacyimports met `feed-lab-v2`/`feed-lab-v3` worden geaccepteerd; `classroom.cohorts` wordt naar respondentgroepen geconverteerd en nieuwe exports bevatten dat oude veld niet.

## Kleuren

Onder **Instellingen → Vormgeving** stel je achtergrond, kaarten/invoervelden, tekst en accent voor knoppen/links in. **Standaardkleuren herstellen** zet de vier standaardwaarden terug. De tekst op accentknoppen wordt automatisch zwart of wit op basis van het contrast met het gekozen accent. Kleuren blijven lokaal bewaard en staan in de geëxporteerde toolconfig.

`theme` accepteert alleen de bekende vier velden met exacte `#RRGGBB`-waarden. Ontbrekende velden krijgen hun standaardkleur. De app zet uitsluitend gevalideerde waarden in vaste CSS-variabelen. Vrije CSS en andere kleurformaten zijn geen geldige invoer. Controleer bij eigen combinaties ook de leesbaarheid van tekst en links op de gekozen kaartkleur.

## Engine en ranking

API via `window.FeedLabEngine` of `require('./engine.js')`:

- `validate(data)` valideert en retourneert de oorspronkelijke data.
- `defaults(data, seed, groupId)` levert samengevoegde begininstellingen.
- `settingsFor(data, partial)` voegt samen en valideert instellingen.
- `themeFor(data)` levert gevalideerde kleuren, aangevuld met `themeDefaults`.
- `rankPosts(data, settings)` en `scorePost(post, data, settings)`.
- `rankComments(data, postId, parentId, settings)` geeft directe kinderen; `null` kiest hoofdreacties.

Instellingen: `seed`, `postRank`, `commentRank`, `commentStanceBias`, `postLimit`, `perTopic`, `commentLimit`, `topicId`, `maxPerAuthor`, `randomWeight`, `likeWeight`, `angryWeight`, `weights`. Limieten zijn gehele getallen vanaf nul; nul betekent onbeperkt. `commentStanceBias` en `weights.stance_bias` liggen in −1..1. Overige gewichten liggen in 0..1. Onbekende overridevelden worden geweigerd.

Postmodi: `weighted`, `likes`, `angry`, `combined`, `reply_count`, `newest`, `random`. Reactiemodi: `thumbs_up`, `thumbs_down`, `angry`, `combined`, `reply_count`, `newest`, `random`. Postgewichten: `stance_bias`, `engagement`, `emotional_intensity`, `information_quality`, `recency`, `controversy`, `novelty`, `predicted_dwell_seconds`, `topic_affinity`.

Gewogen postscore: `(1-randomWeight) × (stance_bias × stance + som gewicht × genormeerd signaal) + randomWeight × hash(seed,id)`. Signalen gebruiken de hele postpool; recency gebruikt vaste datasetdatums. Reactiebias nul behoudt de gewone metriekvolgorde. Anders wordt het ranksignaal binnen dezelfde siblinggroep naar 0..1 genormeerd en wordt `commentStanceBias × stance` toegevoegd. Gelijke scores sorteren op ID. Reacties houden hun eigen auteur, datum, metrics en ouder bij dezelfde post. De reactielimiet geldt per siblinggroep; de interface toont threads maximaal 101 niveaus diep. De volledige bronpool blijft voor alle groepen beschikbaar.

## Opslag, import en export

Alle wijzigingen blijven in dit browserprofiel. Sleutels beginnen met `feedlab-v1:`. Groepstoewijzingen gebruiken `unique_id`; lokale previews gebruiken daarnaast de bronfingerprint en feedstatus ook het groeps-ID. Zo kan een gewijzigde bron nieuwe defaults toepassen en blijft de groep zelf stabiel. Opslagproblemen worden zichtbaar gemeld. Ongeldige import vervangt de actieve feed niet.

- **Antwoorden** exporteert vrijwillige antwoorden met onderzoekscontext.
- **Exporteer instellingen en zichtbare selectie** exporteert toegewezen groep, actieve previewgroep, feedcode, begininstellingen, huidige instellingen, beginpost-IDs, actuele post-IDs en alleen daadwerkelijk uitgeklapte reactie-IDs.
- **Exporteer toolconfig met huidige instellingen** bewaart alle previewinhoud, groepsdefinities, kleuren en huidige regels. De huidige regels komen in `initial_settings` en in de actieve groep. Vóór het aanpassen van de exportdefaults materialiseert de export de effectieve instellingen van alle groepen. Daardoor behouden andere groepen ook geërfde regels, zoals likeWeight, en niet alleen hun expliciete settingsvelden. Dit verandert de live bron niet.

Een toolconfigexport bevat `respondent_assignment:{group_id}`; bij een lokale preview ook `preview_group_id`. Deze context maakt een bestandsimport reproduceerbaar. Bij expliciete import gaan geëxporteerde groep en feedcode vóór bestaande lokale toewijzing en URL-code. Bij gewoon laden blijft `?seed=` voorrang houden en is `?group=` de expliciete docentpreview. Een export is daarmee een overdraagbare huidige feed; verwijder `respondent_assignment` voordat je dezelfde export als nieuwe onderzoeksbron voor willekeurige nieuwe respondenten publiceert. Op gewoon paginaladen wordt dit veld niet als automatische groepskeuze gebruikt.

**Terug naar beginfeed** herstelt de beginsnapshot; lokale aanvullingen blijven in de preview bewaard. Tekst wordt als tekst weergegeven. Afbeeldingen gebruiken absolute http(s)-URLs zonder inloggegevens of ingesloten PNG/JPEG/WebP/GIF-data-URLs, steeds met alt-tekst. Lokale berichten en reacties toevoegen, kleuren kiezen of groepsregels opslaan schrijft niets naar een server.

## Afbeeldingen en placeholders

Iedere post toont een afbeelding. Ontbreekt `image`, dan gebruikt de weergave de lokale `placeholder.svg` met beschrijving **Nog geen afbeelding**. Ook een externe URL die niet laadt krijgt deze placeholder. Een fout bij het laden van de placeholder zelf veroorzaakt geen herhaalde wissel of laadlus. De placeholder is alleen weergavegedrag: er worden geen `image`-velden aan de oorspronkelijke posts toegevoegd en exports verzinnen geen afbeelding.

Onder **Instellingen → Dataset importeren of lokaal aanvullen** kun je bij **Bericht toevoegen** een afbeeldings-URL of een bestand kiezen en de afbeelding beschrijven. In **Afbeelding van bestaand bericht aanpassen** kies je een bestaand bericht en voeg je een URL of upload toe, of wijzig je de beschrijving. Een upload gaat vóór de ingevulde URL. Zonder nieuwe upload of URL blijft de huidige afbeelding behouden. **Afbeelding wissen (placeholder tonen)** verwijdert de lokale afbeeldingswaarde.

Uploads ondersteunen uitsluitend PNG, JPEG, WebP en GIF, maximaal **2 MiB (2.097.152 bytes) per bestand**. SVG-upload is niet toegestaan. De browser leest het bestand met FileReader in als data-URL; de engine accepteert alleen de toegestane MIME-types, strikte base64 en de genoemde gedecodeerde grootte. Imports doorlopen dezelfde enginecontrole. De meegeleverde placeholder is een eigen statische SVG-asset, geen geüploade of geïmporteerde SVG.

Uploads en gewijzigde URL's blijven in de lokale preview en gaan mee in de toolconfigexport. Er wordt geen upload naar een server gedaan. Bij grotere aantallen afbeeldingen kan de browseropslag vol raken; de bestaande opslagmelding wordt dan zichtbaar. Download de toolconfig om de volledige actuele preview mee te nemen. Een reset naar de beginfeed kan de oorspronkelijke afbeeldingen terugtonen; de lokale wijzigingen blijven in de actuele preview bewaard.

## Tests en build

Vanaf de Courses-reporoot:

```sh
node docs/organization/dv11-herinrichting/tool-staging/types/feed-lab/v1/engine.test.cjs
node docs/organization/dv11-herinrichting/tool-staging/types/feed-lab/v1/ui.test.cjs
NODE_PATH="$PWD/node_modules" node docs/organization/dv11-herinrichting/tool-staging/types/feed-lab/v1/build-v1.cjs
```

Enginechecks dekken ranking, bias, graphcontext, instellingenvalidatie en kleurvalidatie. De DOM-harness test gecontroleerde randomwaarden voor één/twee/drie groepen, herladen, gewijzigde bron en verwijderde groepen, docentpreview, groepsauthoring, instellingenisolatie, export/import met een andere bestaande feedcode, kleurenopslag, ongeldige CSS-invoer, effectieve groepsinstellingen na export, placeholders, uploadvalidatie, bestaande afbeeldingen wijzigen en afbeeldingsrondreizen via lokale opslag en import/export. Relevante checks draaien tegen bron en geminificeerde app. Dit bewijst geen volledige browser- of Canvaswerking; browsercontrole, onafhankelijke QA en installatie worden afzonderlijk uitgevoerd.
