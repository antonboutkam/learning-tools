# Feedlab v1

Een zelfstandige Nederlandstalige tool om selectie en rangschikking van posts en reacties te onderzoeken. Bezoekers veranderen inhoudelijke algoritmeregels. De maker beheert broninhoud, afbeeldingen, respondentgroepen en vormgeving via het adminformulier of de configuratie-JSON.

Posts langer dan 175 tekens worden op een heel woord ingekort, met `...` en **Meer weergeven** om de volledige tekst te lezen. Een eerste woord dat zelf langer is dan 175 tekens blijft intact.

## Starten en bezoekersinstellingen

Open `index.html` via een webserver. Standaard wordt `example.json` geladen. Gebruik `?data=URL` voor een eigen configuratie. De app laadt `engine.min.js`, `app.min.js` en `style.min.css`.

Het paneel begint ingeklapt en opent via **Algoritme**. Het bevat uitsluitend regels die bepalen welke berichten en reacties zichtbaar zijn en hoe ze worden gerangschikt:

- Rangschikking van berichten en reacties, onderwerp en standpuntbias.
- Aantal berichten, limieten per onderwerp/auteur en reacties per ouder.
- Toeval en gewichten voor likes, boosreacties en gemodelleerde inhoudssignalen.
- **Terug naar beginfeed** en **Nieuwe toevalsvolgorde**.

De feedcode blijft leesbaar bij **Je eigen venster** en kan via `?seed=vaste-code` worden gedeeld. Er is geen technisch seed-invoerveld in het paneel. Dezelfde bron, code en instellingen leveren dezelfde volgorde.

Er zijn geen bezoekersfuncties voor import, volledige configuratie-export, groepenbeheer, kleurkeuze of inhoud-/afbeeldingsbewerking. Onderzoeksexport en vrijwillige antwoorden blijven beschikbaar als resultaat van de oefening.

Met `showAlgorithmButton: false` in de JSON verberg je de knop en blijft het paneel dicht. Bij deze configuratie worden ook oude lokaal bewaarde algoritmeaanpassingen niet toegepast; de feed gebruikt de ingestelde bron- en groepsregels.

## Configuratie via admin of JSON

Gebruik het schemaformulier van het beherende systeem of wijzig de configuratie-JSON. Dit fragment vult de verplichte bronvelden aan:

```json
{
  "source_format": "feed-lab-v1",
  "initial_settings": {"postLimit": 6},
  "respondent_groups": [
    {"id": "A", "label": "Groep A", "settings": {"commentStanceBias": 1, "weights": {"stance_bias": 1}}},
    {"id": "B", "label": "Groep B", "settings": {"commentStanceBias": -1, "weights": {"stance_bias": -1}}}
  ],
  "showQuestions": false,
  "theme": {"background": "#F0F2F5", "card": "#FFFFFF", "text": "#1C1E21", "accent": "#1877F3"}
}
```

De verplichte bronvelden zijn `title`, `unique_id`, `lesson`, `topics`, `posts`, `comments` en `questions`. `example.json` bevat een complete configuratie. Het schema gebruikt JSON Schema draft 2020-12 en Nederlandse veldlabels. De engine valideert unieke IDs, graphverwijzingen, datums en afbeeldingen. Bestaande extra authoringvelden blijven toegestaan; instellingen, groepsdefinities en kleuren zijn strikt gevalideerd.

Instellingen worden samengevoegd als brondefaults → `initial_settings` → groepsinstellingen, inclusief afzonderlijke gewichten. De regels vullen geen studentantwoorden in. `showQuestions: false` verbergt het vrijwillige vragenpaneel. De legacybronformaten `feed-lab-v2` en `feed-lab-v3` en `classroom.cohorts` blijven ondersteund.

## Respondentgroepen uit de configuratie

Definieer `respondent_groups` uitsluitend via admin of JSON. Bij het eerste bezoek kiest de browser met gelijke kans een groep, onafhankelijk van feedcode, antwoorden en voorkeuren. Eén groep geldt voor iedereen; zonder groepen gelden de standaardregels. Twee groepen geven elk 50% kans, geen gegarandeerde exacte klasbalans.

De toewijzing wordt per `unique_id` in het browserprofiel onthouden. Een gewijzigde bron met hetzelfde ID behoudt de groep zolang die bestaat. Een verwijderde groep leidt tot een nieuwe keuze uit de beschikbare groepen. Nieuwe apparaten, browserprofielen of gewiste opslag krijgen een nieuwe toewijzing. Er is geen centrale registratie of groepstelling.

Het kleine label linksonder toont de toegewezen groep. Een expliciete docentpreview via `?group=A&seed=vaste-code` blijft mogelijk voor groepen uit de bronconfiguratie, zonder de eigen toewijzing te wijzigen. Er is geen groepskiezer of groepseditor in de bezoekersinterface. `respondent_assignment` uit oudere configuratie-exports blijft als legacyveld geaccepteerd, maar bepaalt bij gewoon laden niet de groepstoewijzing.

## Kleuren en afbeeldingen uit de configuratie

Stel `theme.background`, `theme.card`, `theme.text` en `theme.accent` in via admin of JSON. Alleen exacte `#RRGGBB`-waarden zijn toegestaan. Ontbrekende velden gebruiken het standaardpalet: achtergrond `#F0F2F5`, witte kaarten, tekst `#1C1E21` en accent `#1877F3`. Het standaard hoveraccent is `#3B5999`. Accenttekst wordt automatisch zwart of wit op basis van contrast. Controleer bij eigen combinaties ook de leesbaarheid van gewone tekst en links.

De twintig lokale fictieve profielfoto's in `avatars/` zijn vast gekoppeld aan auteur-ID. Dezelfde auteur houdt na sorteren of herladen dezelfde foto. De foto's zijn AI-gegenereerde fictieve volwassenen; `avatars/prompts.json` bevat de prompts.

Afbeeldingen bij posts staan als `image: {url, alt}` in de bron. De engine accepteert absolute HTTP(S)-URLs zonder inloggegevens of ingesloten PNG/JPEG/WebP/GIF-data-URLs tot 2 MiB, met alt-tekst. SVG-data-URLs zijn niet toegestaan. Ontbrekende of niet geladen afbeeldingen gebruiken de lokale `placeholder.svg` met de tekst **Nog geen afbeelding**, zonder een laadlus of wijzigingen aan de brondata. Het admin- of configuratiesysteem beheert het toevoegen of vervangen van afbeeldingen; de bezoekersinterface bevat geen uploads.

## Engine en ranking

API via `window.FeedLabEngine` of `require('./engine.js')`:

- `validate(data)` valideert en retourneert de oorspronkelijke data.
- `defaults(data, seed, groupId)` levert samengevoegde begininstellingen.
- `settingsFor(data, partial)` voegt samen en valideert instellingen.
- `themeFor(data)` levert gevalideerde kleuren, aangevuld met `themeDefaults`.
- `rankPosts(data, settings)` en `scorePost(post, data, settings)`.
- `rankComments(data, postId, parentId, settings)` levert directe kinderen; `null` kiest hoofdreacties.

Instellingen: `seed`, `postRank`, `commentRank`, `commentStanceBias`, `postLimit`, `perTopic`, `commentLimit`, `topicId`, `maxPerAuthor`, `randomWeight`, `likeWeight`, `angryWeight` en `weights`. Limieten zijn gehele getallen vanaf nul; nul betekent onbeperkt. Reactie- en standpuntbias liggen in −1..1. Overige gewichten liggen in 0..1.

Postmodi: `weighted`, `likes`, `angry`, `combined`, `reply_count`, `newest`, `random`. Reactiemodi: `thumbs_up`, `thumbs_down`, `angry`, `combined`, `reply_count`, `newest`, `random`.

Gewogen postscore: `(1-randomWeight) × (stance_bias × stance + som gewicht × genormeerd signaal) + randomWeight × hash(seed,id)`. Signalen gebruiken de hele postpool. Reactiebias nul behoudt de metriekvolgorde; anders wordt het ranksignaal binnen dezelfde siblinggroep genormeerd en wordt `commentStanceBias × stance` toegevoegd. Gelijke scores sorteren op ID. Reacties behouden hun auteur, datum, metrics en ouder bij dezelfde post. De reactielimiet geldt per siblinggroep; threads worden maximaal 101 niveaus diep weergegeven.

## Lokale voortgang en onderzoeksexport

Alleen algoritmeregels, begininstellingen, antwoorden en automatische groepstoewijzing worden lokaal bewaard. Sleutels beginnen met `feedlab-v1:`. De groepstoewijzing gebruikt `unique_id`; feedstatus gebruikt daarnaast de bronfingerprint en het groeps-ID.

De geladen JSON bepaalt altijd de actuele broninhoud, groepen en kleuren. Oude lokale beheerpreviews en bewerkte beginsnapshots uit eerdere versies worden genegeerd. Bestaande opslagbestanden worden niet verwijderd. **Terug naar beginfeed** herstelt de broninstellingen voor de eigen groep en oorspronkelijke feedcode.

- **Antwoorden (.json)** en **Als tekst** exporteren vrijwillige antwoorden met onderzoekscontext.
- **Exporteer instellingen en zichtbare selectie** exporteert toegewezen en actieve groep, feedcode, begininstellingen, huidige instellingen, beginpost-IDs, actuele post-IDs en uitsluitend uitgeklapte reactie-IDs.

Onderzoeksexport is geen volledige toolconfiguratie en bevat geen broninhoud of vormgevingsbeheer. Er is geen importfunctie. Opslagproblemen worden zichtbaar gemeld; antwoorden en onderzoek blijven handmatig te exporteren. Er is geen Canvas-score-passback.

## Tests en build

Vanaf de Learning Tools-reporoot:

```sh
node public_html/types/feed-lab/v1/engine.test.cjs
node public_html/types/feed-lab/v1/ui.test.cjs
NODE_PATH=/home/anton/Documents/sites/courses/node_modules node public_html/types/feed-lab/v1/build-v1.cjs
FEEDLAB_MINIFIED=1 node public_html/types/feed-lab/v1/ui.test.cjs
```

De build vraagt `terser` en `clean-css`; pas `NODE_PATH` aan wanneer die modules elders staan. De interfacechecks dekken inhoudelijke regels, het ontbreken van beheeropties, bron- en groepsregels, kleurconfiguratie, het negeren van oude beheerpreviews, reset, vragen, onderzoeksexport, tekstweergave en afbeeldingen. De enginechecks dekken ranking en bronvalidatie. DOM-tests zijn geen volledige visuele browser- of Canvascontrole.
