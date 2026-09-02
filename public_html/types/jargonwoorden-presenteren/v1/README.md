# Jargonwoorden presenteren v1

Een live klasactiviteit met drie weergaven. Courses geeft de actuele context door via `canvas_course_view` en `canvas_course_mode`.

- `?canvas_course_view=teacher&canvas_course_mode=plenary&unique_id=<id>&data=<config-url>` claimt de docentrol. Per `unique_id` kan slechts één server-side docentclaim bestaan.
- `?canvas_course_view=student&canvas_course_mode=individual&unique_id=<id>&data=<config-url>` vraagt een naam, bewaart die als `jargonwoorden-presenteren:naam:<unique_id>` in localStorage en laat de naam alleen via "Naam wijzigen" aanpassen.
- `?canvas_course_view=presentation&canvas_course_mode=plenary&unique_id=<id>&data=<config-url>` is het gedeelde scherm met letterbalk, woorden links, studenten rechts, stemmen en score.

De defaults zijn `canvas_course_view=student` en `canvas_course_mode=individual`. `role=docent|student|presentatie` blijft als tijdelijke fallback beschikbaar voor oude losse demo-links.

De tool gebruikt `api.php` voor gedeelde sessiestatus. De eerste docentpagina maakt de sessie aan; studenten melden zich daarna aan en zien in hun eigen scherm duidelijk welke naam de server heeft geregistreerd. Studenten die tijdens een lopende onderzoeksronde binnenkomen, krijgen alleen de nog resterende rondes. De server gebruikt een deelnemertoken voor naam- en stemmutaties; IP-adres/user-agent worden als aanvullende docentclaim opgeslagen, maar een browser-token blijft de betrouwbare sessie-identiteit.

## Courses-configuratie

Gebruik deze JSON als configuratiedata in Courses:

```json
{
  "aantalWoordenPerStudent": 3,
  "onderzoektijdPerWoordInSeconden": 120,
  "spreektijdInSeconden": 60,
  "jargonWoorden": ["Klantvraag", "Requirements", "Prototype"]
}
```

De tool toont de vijf presentatievragen al tijdens het onderzoek en daarna opnieuw bij de presentatie: wat is het, waar kom je het tegen, geef een voorbeeld, waarom is het belangrijk, en leg het uit aan iemand die het woord nog nooit heeft gehoord. De docent kan een onderzoeksronde direct overslaan of de presentatiefase opnieuw starten zonder opnieuw te onderzoeken. Stemmen geven of nemen 5 seconden; per presentator kan een student maar één keer stemmen.

## Feedback voor Codex / Courses

**Klantvraag:** Maak een speelse live klasactiviteit waarin studenten jargonwoorden onderzoeken en daarna presenteren. De docent verdeelt woorden, bedient timers en rouleert studenten en woorden op een gedeeld presentatiescherm.

**Requirements:** De configuratie bevat `aantalWoordenPerStudent`, `onderzoektijdPerWoordInSeconden`, `spreektijdInSeconden` en `jargonWoorden`. De tool heeft docent-, student- en presentatiemodus met live synchronisatie, late instroom, naamopslag, timers, stemmen, scorebord en afronden.

**Programma van eisen:** Studenten krijgen maximaal het ingestelde aantal unieke woorden en per woord onderzoekstijd met een ringtimer en optionele bel. De docent kan starten, herstarten, student/woord spinnen, presentatietijd starten, scores tonen en de activiteit afronden.

**Prototype:** Bouw een kleurrijke, speelse interface met een docentdashboard, een studentenscherm en een groot presentatiescherm. Gebruik een digitale letterbalk voor het spinnen, grappige studenticoontjes, een wachtanimatie met puntjes en korte humoristische teksten.

**MVP:** Implementeer eerst sessieclaim, studentaanmelding, woordverdeling, onderzoeksrondes, presentatie-roulette en een gedeelde timer. Voeg daarna stemmen, top vijf, docent-scoreweergave, reset en browserbel toe.

**Microcontroller:** Een microcontroller is een kleine computer op één chip die een apparaat of proces bestuurt. Hij leest vaak sensoren uit en stuurt actuatoren aan.

**Sensor:** Een sensor meet een fysieke eigenschap, zoals temperatuur, licht of beweging. De meting wordt als informatie doorgegeven aan een controller of computer.

**Actuator:** Een actuator zet een elektrisch besturingssignaal om in een actie. Voorbeelden zijn een motor, lamp, relais of ventiel.

**Interface:** Een interface is de manier waarop een gebruiker of systeem met een ander systeem communiceert. Bij software gaat het bijvoorbeeld om knoppen en schermen; bij hardware om aansluitingen en communicatieprotocollen.
