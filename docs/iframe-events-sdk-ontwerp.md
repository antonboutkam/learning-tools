# Ontwerp: generieke events tussen Learning Tools en Courses

## Samenvatting

De Learning Tools zijn nu zelfstandige, versiegebonden iframe-applicaties. De meeste tools laden alleen JSON via `?data=` en geven geen resultaat door aan de omliggende pagina. Dat is een goede basis voor hergebruik, maar onvoldoende voor samengestelde leeractiviteiten.

Aanbevolen oplossing:

1. Voeg een kleine, optionele **Learning Tools Events SDK** toe aan de gedeelde bestanden.
2. Laat een tool gebeurtenissen publiceren via `window.parent.postMessage()`.
3. Laat de omliggende pagina in Courses gebeurtenissen abonneren en daarop reageren.
4. Laat Courses de volgorde en zichtbaarheid van meerdere tools beheren.
5. Gebruik een server-side endpoint of LTI/AGS wanneer een resultaat blijvend moet worden opgeslagen of als Canvas-score moet gelden.

Een aparte overkoepelende Learning Tool kan later nuttig zijn voor een volledig zelfstandige route, maar is niet nodig voor de eerste versie. De orchestrator hoort bij voorkeur in Courses, omdat daar de omliggende content, de studentcontext en de plaatsing van iframes bekend zijn.

## Waarom een eventlaag nodig is

De bestaande `public_html/shared/completion.js` bewaart voltooiing lokaal in `localStorage` en toont een certificaatbanner. Dat is geschikt voor lokale UI-status, maar de ouderpagina kan daar niet betrouwbaar op reageren. Bovendien is localStorage bij cross-origin iframes niet hetzelfde opslaggebied als bij Courses en is het geen serverregistratie.

Er zijn daarom drie verschillende vormen van status:

| Doel | Mechanisme | Eigenschap |
| --- | --- | --- |
| Direct reageren in de omliggende pagina | `postMessage` | Snel, tijdelijk, client-side |
| Meerdere iframes in één leerroute schakelen | Courses orchestrator | Bepaalt layout, volgorde en zichtbaarheid |
| Resultaat bewaren of naar Canvas sturen | Courses/backend of LTI 1.3 + AGS | Duurzaam en controleerbaar |

Deze mechanismen moeten niet met elkaar worden verward. Een ontvangen browser-event is bijvoorbeeld nog geen bewijs dat een Canvas-inzending of server-save is gelukt.

## Architectuur

```text
Learning Tool iframe
  └─ LearningToolsEvents.publish(event)
       └─ window.parent.postMessage(envelope, coursesOrigin)
            └─ Courses LearningRoute/orchestrator
                 ├─ status tonen of volgende content activeren
                 ├─ volgend iframe tonen/verbergen/wisselen
                 └─ resultaat eventueel naar backend/LTI sturen
```

De SDK heeft twee kanten:

- **Publisher in de tool:** publiceert alleen gebeurtenissen die bij de tool horen.
- **Subscriber/orchestrator in Courses:** valideert, interpreteert en voert routeacties uit.

De SDK moet optioneel zijn. Een tool moet zonder ouderpagina, bijvoorbeeld via de bestaande demo-URL, blijven werken.

## Eventcontract

Gebruik één vaste envelope. Een eerste contractversie kan er zo uitzien:

```json
{
  "protocol": "learning-tools-events",
  "version": 1,
  "messageId": "01J...",
  "event": "tool.completed",
  "source": {
    "toolId": "juiste-volgorde",
    "toolVersion": "v1",
    "uniqueId": "opdracht-001",
    "instanceId": "route-onderdeel-3"
  },
  "occurredAt": "2026-09-14T10:30:00.000Z",
  "payload": {
    "completed": true,
    "score": {
      "correct": 5,
      "total": 5
    }
  }
}
```

### Minimale events

- `tool.ready` — configuratie is geladen en de tool kan worden gebruikt.
- `tool.started` — de student heeft daadwerkelijk interactie gestart.
- `tool.completed` — de tool is volgens zijn eigen beoordelingslogica afgerond.
- `tool.reset` — lokale voortgang is opnieuw gestart.
- `tool.error` — een gebruikersrelevante fout, bijvoorbeeld ontbrekende configuratie.
- `slide.changed` — een presentatie-/striptool is naar een andere slide gegaan.
- `task.completed` — een benoemde deelopdracht binnen een tool is afgerond.

Niet iedere klik hoeft een event te zijn. Publiceer alleen betekenisvolle domeingebeurtenissen. Gebruik voor slide-events bijvoorbeeld een stabiele `slideId` naast het mensgerichte slidennummer; arrayposities kunnen in een nieuwe versie veranderen.

Voorbeeld:

```json
{
  "protocol": "learning-tools-events",
  "version": 1,
  "messageId": "01J...",
  "event": "slide.changed",
  "source": {
    "toolId": "strip-ballonnetjes",
    "toolVersion": "v1",
    "uniqueId": "apollo-route",
    "instanceId": "verhaal-1"
  },
  "occurredAt": "2026-09-14T10:31:00.000Z",
  "payload": {
    "slideId": "opdracht-1",
    "slideNumber": 7,
    "totalSlides": 10
  }
}
```

## SDK-API

De publieke API moet klein blijven. Conceptueel:

```js
const events = window.LearningToolsEvents.create({
  toolId: "strip-ballonnetjes",
  version: "v1",
  uniqueId,
  parentOrigin: "https://courses.devroc.nl",
});

events.publish("slide.changed", {
  slideId: "opdracht-1",
  slideNumber: 7,
  totalSlides: 10,
});
```

Aan de Courses-kant:

```js
const unsubscribe = LearningToolsRoute.subscribe((message) => {
  if (message.event === "tool.completed" && message.payload.score?.correct === message.payload.score?.total) {
    showNextStep("reflectie");
  }
});
```

De uiteindelijke implementatie moet bij voorkeur ook een handshake ondersteunen:

1. Courses stuurt `host.hello` met protocolversie en toegestane mogelijkheden.
2. De tool stuurt `tool.ready` terug.
3. Daarna worden domeinevents geaccepteerd.

Daarmee kunnen oude tools veilig blijven draaien en kan de host zien of een tool eventondersteuning heeft.

## Beveiliging en betrouwbaarheid

`postMessage` is alleen veilig wanneer beide kanten het bericht valideren.

- Gebruik een expliciete `targetOrigin`; gebruik niet standaard `*`.
- Accepteer berichten alleen wanneer `event.origin` exact de verwachte Courses-origin is.
- Controleer ook `event.source === iframe.contentWindow`.
- Valideer protocol, versie, eventnaam, bronvelden en payload-vorm.
- Gebruik een unieke `messageId` en negeer duplicaten.
- Behandel events als hints voor UI-routing, niet als autorisatie of cijferbewijs.
- Zet geen tokens, persoonsgegevens of volledige antwoorden in een event dat niet nodig is.
- Laat `parentOrigin` alleen uit een gecontroleerde launchcontext komen; maak geen willekeurige origin uit onbeveiligde data tot vertrouwde host.
- Registreer de exacte producerende tool en versie in elk bericht.

De host moet rekening houden met een iframe dat opnieuw laadt, te vroeg een event stuurt of helemaal geen event ondersteunt. Routeconfiguratie moet daarom ook een expliciete fallback hebben: bijvoorbeeld handmatig doorgaan, foutmelding tonen of opnieuw initialiseren.

## Voorbeeld: strip met opdracht op slide 7 en 8

Een strip kan op slide 7 `task.completed` publiceren. Courses verbergt dan de strip en toont een tweede tool. Na afronding van die opdracht wordt slide 8 zichtbaar.

```js
if (message.event === "task.completed" && message.payload.taskId === "opdracht-slide-7") {
  route.show("opdracht-7");
}

if (message.event === "tool.completed" && message.source.instanceId === "opdracht-7") {
  route.show("strip-slide-8");
}
```

Dit vereist geen speciale “slimme” tool. Courses beheert bijvoorbeeld een lijst met routeonderdelen:

```json
{
  "routeId": "apollo-1",
  "steps": [
    { "id": "strip-slide-1-7", "tool": "strip-ballonnetjes/v1" },
    {
      "id": "opdracht-7",
      "tool": "juiste-volgorde/v1",
      "showWhen": { "event": "slide.changed", "slideId": "opdracht-1" }
    },
    {
      "id": "strip-slide-8",
      "showWhen": { "event": "tool.completed", "instanceId": "opdracht-7" }
    }
  ]
}
```

In de praktijk is het verstandig om de strip zelf te laten pauzeren op een marker, zodat de student niet langs de opdracht kan navigeren. Dat is toolgedrag en hoort in de stripconfiguratie; de host bepaalt vervolgens welke opdracht wordt ingeladen.

## Wanneer een event niet genoeg is

Voor “student heeft het goed gemaakt” zijn twee situaties mogelijk:

1. **Alleen interactie in deze pagina:** `tool.completed` met scorepayload is voldoende om de volgende stap te tonen.
2. **Bewaarbaar resultaat:** Courses ontvangt het event, maar stuurt het resultaat door naar een beveiligd backend-endpoint. Het backend controleert de routecontext en slaat het resultaat op. Voor Canvas-cijfers blijft LTI 1.3/AGS nodig.

Een browser-event kan door een refresh, gesloten tabblad of kwaadwillende client verloren of gemanipuleerd worden. De backend moet dus idempotent kunnen opslaan op bijvoorbeeld `courseId + userId + instanceId + attemptId` en een eigen serverstatus teruggeven.

## Relatie met de huidige repo

- Plaats de generieke publisher in `public_html/shared/`, naast `completion.js`.
- Voeg geen eventlogica toe aan alle tools tegelijk. Begin met één nieuwe opt-in integratie.
- Laat `completion.js` intern `tool.completed` publiceren wanneer `markCompleted()` wordt aangeroepen; bestaande tools krijgen dan meteen beperkte interoperabiliteit zodra zij de shared SDK laden.
- Voeg voor interactieve tool-specifieke events kleine adapters toe in de betreffende `app.js` of `tool.js`.
- Houd toolversies backwards-compatible: voeg ondersteuning toe in een nieuwe toolversie wanneer de betekenis of configuratie verandert.
- Documenteer het protocol in `docs/` en voeg eventueel een registry-capability toe, bijvoorbeeld `events: { protocol: "learning-tools-events", version: 1 }`.
- Werk bij een echte implementatie de tool-runtime, eventuele `schema.json`, `example.json`, registry en agentdocumentatie samen bij volgens de repo-conventies.

## Voorgestelde implementatiefasen

### Fase 1 — client-side basis

- `public_html/shared/events.js` maken.
- Envelope, originvalidatie, handshake en deduplicatie implementeren.
- Een kleine host-testpagina maken met één iframe en een eventlog.
- `completion.js` koppelen aan `tool.completed`.

### Fase 2 — eerste echte route

- In Courses een `LearningToolsRoute`/orchestrator maken.
- Eén strip en één opdracht koppelen.
- Ondersteunen: tonen, verbergen, pauzeren, opnieuw laden en fallback bij ontbrekende events.
- Testen met een goede afronding, fout antwoord, reset, refresh en twee iframes tegelijk.

### Fase 3 — duurzame resultaten

- Backendcontract bepalen voor route-events en pogingen.
- Server-side autorisatie en idempotente opslag toevoegen.
- Alleen wanneer nodig: LTI 1.3/AGS voor Canvas scorepassback.

### Fase 4 — declaratieve routeconfiguratie

- Routeconfiguratie door Courses laten genereren/beheren.
- `showWhen`-voorwaarden beperken tot een gecontroleerde set operators.
- Een debugmodus toevoegen die ontvangen events, origin, iframe-instance en routebeslissing toont.

## Niet doen in de eerste versie

- Geen vrije JavaScript-code of willekeurige URL’s in routeconfiguratie uitvoeren.
- Geen eventbus via `localStorage`; dat werkt niet goed als cross-origin transport en is geen betrouwbare queue.
- Geen afhankelijkheid van Canvas-specifieke claims in iedere standalone tool.
- Geen centrale “super-tool” die alle andere tools opnieuw implementeert.
- Geen automatische cijferregistratie op basis van alleen een client-side event.

## Beslispunten

Voor de start van de implementatie moeten nog worden vastgesteld:

- Is `https://courses.devroc.nl` de enige toegestane host-origin, of bestaan er ook staging/demo-origins?
- Welke gebeurtenissen moeten direct beschikbaar zijn in v1: alleen completion en reset, of ook slide- en deelopdrachten?
- Moet Courses alleen in dezelfde pagina schakelen, of moeten events ook server-side worden opgeslagen?
- Welke scoredefinitie geldt generiek: `correct/total`, percentage, geslaagd/niet-geslaagd, of tool-specifieke details?
- Wordt de routeconfiguratie onderdeel van Courses, of is er een klein routebestand in deze repo nodig?

## Eindadvies

Start met een versie 1 van `LearningToolsEvents` als klein browserprotocol en een Courses-orchestrator. Koppel eerst `completion.js` en één stripscenario. Daarmee wordt de belangrijkste use-case bewezen zonder de standalone tools of hun bestaande iframe-URL’s te breken. Voeg pas daarna duurzame opslag en LTI-scorepassback toe. Een overkoepelende Learning Tool is alleen zinvol wanneer dezelfde route ook buiten Courses, als zelfstandige interactieve presentatie, moet kunnen draaien.
