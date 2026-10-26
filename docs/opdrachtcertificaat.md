# Opdrachtcertificaat v1

Een formatieve les afronden, naam en klas invullen en één ondertekend JSON-bestand downloaden om in Canvas in te leveren. De negen oefeningen met `supportsCompletion: true` rapporteren hun eigen succesvolle afronding. De server vertrouwt deze clientresultaten; de handtekening bewijst uitgifte en ongewijzigde gegevens, geen studentidentiteit of zelfstandig werk.

## Een pagina samenstellen

1. Geef elke oefening een eigen stabiele `unique_id` in de iframe-URL. Twee instanties van hetzelfde tooltype krijgen verschillende ID's.
2. Voeg één Opdrachtcertificaat-iframe toe met `?data=<configuratie-URL>`.
3. Vermeld alle vereiste oefeningen expliciet in `requiredTools`, met exact hun `unique_id` en een leesbare titel. Niet-beoordeelbare tools tellen niet mee. De certificaattool zelf telt niet mee.
4. Registreer dezelfde configuratie op de certificaatserver als `<groupId>--<revision>.json` in de manifestmap. De serverlijst is leidend. De browser kan de lijst niet inkorten om een certificaat te krijgen.
5. Verhoog `revision` bij gewijzigde opdrachten. Gebruik bij inhoudelijke wijzigingen ook nieuwe oefening-ID's, zodat bestaande lokale antwoordopslag niet op gewijzigde oefeningen wordt toegepast.

Voorbeeld: `public_html/types/opdrachtcertificaat/v1/example.json`. De bijbehorende demonstratiepagina is `/types/opdrachtcertificaat/v1/demo.html`.

```json
{
  "groupId": "demo-certificaat",
  "revision": "1",
  "title": "Mijn eerste opdrachtcertificaat",
  "requiredTools": [
    { "id": "cert-demo-volgorde", "title": "Zet de stappen in de juiste volgorde" },
    { "id": "cert-demo-koppelen", "title": "Koppel de juiste begrippen" }
  ]
}
```

Courses kan deze lijst genereren uit de oefening-instanties op de pagina met `supportsCompletion: true`. Deze repository bevat de tool, het contract en een werkende voorbeeldpagina; de automatische pagina-export/manifestregistratie in de aparte Courses-repository is nog niet geïmplementeerd.

## Eenmalige serverinrichting

Voor deze lokale installatie is een vaste sleutel aangemaakt in `.private/opdrachtcertificaat/`, buiten `public_html` en uitgesloten van Git. De API gebruikt standaard `.private/opdrachtcertificaat/config.json`; `LT_CERTIFICATE_CONFIG` heeft voorrang. De sleutel blijft gelijk bij herstarts. De private map heeft modus 0700 en de sleutel 0600. Kopieer deze sleutel niet naar publieke bestanden; bij deployment moet de private configuratie apart worden ingericht voor het PHP-serviceaccount.

PHP 8.1+ met Sodium, schrijfrechten voor de private opslag en HTTPS in productie zijn nodig. Er zijn geen Composer-afhankelijkheden. De API staat op `/types/opdrachtcertificaat/v1/api.php`. Zonder serverconfiguratie geeft deze 503 en worden geen ongetekende certificaten aangeboden.

Maak een **nieuwe map buiten alle webroots**. Laat het PHP-serviceaccount de bestanden lezen en de recordsmap beschrijven; de setup maakt mappen met 0700 en bestanden met 0600. Gebruik geen publieke map, Git-repository of gedeelde tijdelijke map voor echte sleutels en persoonsgegevens.

```sh
php scripts/certificate-setup.php /veilig/privepad/learning-tools-certificates
```

Stel in de PHP-serveromgeving in:

```text
LT_CERTIFICATE_CONFIG=/veilig/privepad/learning-tools-certificates/config.json
```

De setup levert een private sleutel, `public-keys.json`, configuratie, recordsmap en het demomanifest. De geheime sleutel en records mogen nooit via HTTP bereikbaar zijn. Alleen `public-keys.json` mag naar het nakijkprogramma worden gekopieerd. Bewaar oude publieke sleutels bij sleutelrotatie; bestaande certificaten blijven daarmee controleerbaar. Maak een back-up van de private uitgiftegegevens en bepaal zelf de bewaartermijn voor persoonsgegevens.

Voor een lokale test met tijdelijke sleutels:

```sh
php scripts/certificate-setup.php /tmp/learning-tools-certificate-demo
LT_CERTIFICATE_CONFIG=/tmp/learning-tools-certificate-demo/config.json php -S 127.0.0.1:8097 -t public_html
```

Open `http://127.0.0.1:8097/types/opdrachtcertificaat/v1/demo.html`. Het setupprogramma weigert een bestaand pad, zodat sleutels nooit stilzwijgend worden overschreven. Er is geen productieconfiguratie of deploy uitgevoerd door deze implementatie.

## Studentervaring en pogingen

- Alleen een actieve certificaattool **in dezelfde bovenliggende pagina** activeert de gezamenlijke meldingen.
- De oefening toont de score, “Je hebt deze opdracht goed gemaakt” en het aantal overige opdrachten. Zonder certificaattool blijft de bestaande zelfstandige werking behouden.
- Ontbrekende/nog niet geladen oefeningen blijven openstaan. Lazy-loaded iframes kunnen vereisen dat de student naar beneden scrollt.
- Succes wordt bewaard per groep, revisie, poging en opdracht-ID. Oude standalone certificaatvlaggen worden niet automatisch als nieuwe groepsresultaten geïmporteerd. Een succes dat in de huidige pagina vóór de handshake is behaald kan wel aansluiten.
- Een oefening opnieuw doen wist de afronding voor de actieve poging. Een reeds uitgegeven certificaat blijft een historisch bewijs en wordt niet ingetrokken.
- De student vult naam en klas pas in wanneer alles klaar is. Persoonsgegevens gaan uitsluitend naar de uitgifte-API, niet in berichten tussen oefeningen.
- De download heet `certificaat-<groupId>-<certificateId>.json` en bevat de ondertekende gegevens als base64-payload.
- De server bewaart maximaal één certificaat per groep/revisie/poging. Dezelfde aanvraag geeft hetzelfde bestand terug. Een andere naam of klas op dezelfde poging geeft 409.
- Bij een onzekere netwerkuitkomst bewaart de browser de exacte aanvraag. Opnieuw ophalen gebruikt dezelfde poging en identiteit; er wordt niet stilzwijgend een nieuwe poging gemaakt.
- Na uitgifte kan een student bewust een nieuwe poging voor een andere student starten. Dat wist de gezamenlijke voltooiingen voor de nieuwe poging en herstart aangesloten oefeningen. Browseropslag wissen kan de beperking eveneens omzeilen; dat is geaccepteerd voor formatief gebruik.
- Blokkeert de browser opslag, dan blijft de actieve sessie bruikbaar maar moet het tabblad open blijven. Lokale opslag bevat na uitgifte ook naam en klas; op gedeelde computers is de nieuwe-pogingknop belangrijk.

## Communicatiecontract

`public_html/shared/certificate-channel.js` verzorgt directe `postMessage`-communicatie tussen toolframes. Een beperkte zoektocht door de frameboom ontdekt ook geneste frames; de Canvas-ouder hoeft geen script uit te voeren.

```json
{
  "protocol": "learning-tools-certificate-v1",
  "sender": "willekeurige-frame-id",
  "event": "tool.state",
  "payload": {
    "groupId": "demo-certificaat",
    "revision": "1",
    "attemptId": "willekeurige-uuid-v4",
    "uniqueId": "cert-demo-volgorde",
    "result": {
      "completed": true,
      "completedAt": "2026-10-26T08:15:00.000Z",
      "score": { "correct": 4, "total": 4 }
    }
  }
}
```

- `certificate.hello`: coordinator stuurt lijst/context; iedere twee seconden voor late frames en herladen.
- `tool.state`: aangesloten oefening antwoordt met resultaat of `null`; succes en reset worden direct gepubliceerd.
- `certificate.progress`: coordinator stuurt resterend aantal.
- De ontvanger controleert exact de eigen origin, protocol, bronvenster, dezelfde `window.top`, groepscontext en opdracht-ID. Berichten worden niet met `targetOrigin: '*'` verstuurd.
- Andere tabbladen activeren geen groepsmodus. Opslag is wel gedeeld per browserprofiel: een herladen pagina kan dezelfde poging hervatten. Dit is geen studentauthenticatie.
- Na wegvallen van de coordinator vervalt de groepsmodus binnen circa zeven seconden.
- Alle deelnemende tools moeten dezelfde origin hebben en scripts mogen uitvoeren. Bij meerdere coordinators voor dezelfde oefening geldt de eerste actieve coordinator; configureer één certificaattool per pagina.
- De oude `docs/iframe-events-sdk-ontwerp.md` blijft een breder ontwerp voor Courses-routing; dit certificaatprotocol is de concrete, smallere implementatie en geen implementatie van alle daar genoemde events.

Scorevormen: `correct/total` voor quizzen en aantal kamers; `value` voor de ruwe, mogelijk negatieve Feedalgoritme-score. Geen kunstmatige omzetting van feedpunten naar goede antwoorden.

## Automatisch nakijken

Voorbeeld van `verwachting.json`, afkomstig van de docent/nakijkomgeving, niet van het studentbestand:

```json
{
  "groupId": "demo-certificaat",
  "revision": "1",
  "studentName": "Zoë Voorbeeld",
  "studentClass": "SD4",
  "requiredToolIds": ["cert-demo-volgorde", "cert-demo-koppelen"]
}
```

```sh
php scripts/certificate-verify.php certificaat.json public-keys.json verwachting.json
```

De uitvoer is JSON. Exitcode 0: `voldaan`; 1: `ongeldig`; 2: `handmatig_controleren`. Zonder volledige verwachting wordt de handtekening wel gecontroleerd maar volgt geen automatische voldoende. Naam/klas worden exact vergeleken; afwijkende schrijfwijzen gaan naar handmatige controle.

Het nakijkprogramma geeft de certificaat-ID en poging-ID terug. Een externe batch-/Canvas-nakijker kan die bijhouden om hetzelfde certificaat bij meerdere inzenders te signaleren. Deze CLI haalt zelf geen Canvas-inzendingen op en beheert geen inzenderregister.

De envelope heeft `format`, `keyId`, `payload` en `signature`. `payload` is standaard base64 van UTF-8 JSON. `signature` is standaard base64 van een Ed25519-handtekening over:

```text
UTF8(format + "\n" + keyId + "\n") + BASE64_DECODE(payload)
```

Verifieer met een vooraf vertrouwde publieke sleutel uit `public-keys.json`; vertrouw nooit een sleutel die de student zelf meestuurt. Lees de payload pas als gecontroleerde certificaatgegevens nadat de handtekening geldig is. Het buitenste JSON mag andere inspringing of veldvolgorde krijgen. De exacte payloadbytes worden ondertekend en hoeven voor verificatie niet opnieuw als JSON te worden geserialiseerd.

`issuedAt` is servertijd. `clientCompletedAt` is de door de browser opgegeven tijd en is geen onafhankelijke tijdmeting. `assessment: formative-client-reported` maakt de vertrouwensgrens expliciet.

## Canvas-bijlagen en toekomstig standalone pakket

De huidige versie werkt met losse iframes vanaf dezelfde Learning Tools-origin, ook onder een cross-origin bovenliggende pagina. De echte Canvas-omgeving en mobiele app zijn nog afzonderlijk te testen. Verschillende Canvas-bestandsorigins of opaque sandbox-origins worden niet ondersteund door dit transport. Er is geen brede CORS-toegang toegevoegd aan de uitgifte-API.

Een toekomstige HTML-lesbundel kan alle oefeningen en de coordinator meenemen. Daarvoor moeten assetpaden, originbeleid, downloadrechten en het contact met de certificaatdienst expliciet worden uitgewerkt. Dat exportpakket is geen onderdeel van deze v1. Zonder servercontact kan geen nieuw serverondertekend certificaat worden uitgegeven.

## Controles

```sh
php tests/certificates/service.test.php
node public_html/types/feed-algoritme-handmatig/v1/runtime.test.cjs
LT_PLAYWRIGHT_MODULE=/pad/naar/playwright node tests/certificates/browser.test.cjs
```

De browsertest gebruikt tijdelijke private sleutels en een tijdelijke PHP-server. Hij maakt de echte volgorde- en koppeloefening via de UI, controleert cross-origin embedding, resets, herladen, tabbladscheiding, de download en de CLI-verificatie. Playwright met Chromium moet geïnstalleerd zijn. Testartefacten blijven onder `/tmp/lt-certificate-browser-*`; gebruik deze tijdelijke sleutels nooit in productie.
