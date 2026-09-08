# Tooldocumentatie

Deze map bevat de gegenereerde, agentvriendelijke documentatie per toolversie. De bewerkbare bron is [catalog.json](catalog.json); genereer na een wijziging opnieuw met:

`node scripts/build-tool-docs.mjs`

`versions/index.json` is de machineleesbare, geaggregeerde index.

## Toepassingen

- **Actieve woordenschat**: Jargonwoorden presenteren (v1)
- **Automatische presentatie**: Slide-show (v1)
- **Beeld met getimede tekstlagen**: Slide-show (v1)
- **Begrippen herkennen**: Kies de juiste afbeelding (v1)
- **Begrippen koppelen**: Wat hoort bij wat (v1)
- **Begrippen verbinden**: Mindmap (v1)
- **Bericht uit de toekomst**: Digitaal bericht — toekomst (v2) (v2)
- **Binair, decimaal en hexadecimaal vergelijken**: Bin/Hex/Dec Reken (v1)
- **Brainstormen**: Mindmap (v1)
- **Chronologie ordenen**: Juiste volgorde (v1)
- **Code met afleiders bespreken**: Code in volgorde zetten (v1)
- **Energizer**: Pubquiz Yes/No (v1)
- **Getalstelsels oefenen**: Bin/Hex/Dec Reken (v1)
- **Historische tijdlijn**: Timeline (v1)
- **Individuele of gezamenlijke woordwebben**: Mindmap (v1)
- **Instructies presenteren**: Slide-show (v1)
- **Invuloefening in context**: Strip ballonnetjes (v1)
- **Kanban/sprintbord**: Scrumboard (v1)
- **Klassikale jargonverkenning**: Jargonwoorden presenteren (v1)
- **Klassikale teamindeling**: QR team with role divide (v1)
- **Lesnotities verzamelen**: Notities (v1)
- **Loopbaan- of toekomstverhaal**: Timeline (v1)
- **Markdown leren**: Markdown editor (v1)
- **Persoonlijke planning**: Scrumboard (v1)
- **Presenteren met peer-feedback**: Jargonwoorden presenteren (v1)
- **Processtappen oefenen**: Juiste volgorde (v1)
- **Programmeerstappen ordenen**: Code in volgorde zetten (v1)
- **Projectplanning**: Timeline (v1)
- **Reflectie of schetsen**: Notities (v1)
- **Retro/computerhistorie-sfeer**: Digitaal bericht (C64) (v1)
- **Rolroulatie**: QR team with role divide (v1)
- **Samenwerkingsopdracht met telefoon**: QR team with role divide (v1)
- **Sfeervolle lesopening of reflectie**: Digitaal bericht — toekomst (v2) (v2)
- **Sociale situaties bespreken**: Strip ballonnetjes (v1)
- **Stripverhaal met dialoog**: Strip ballonnetjes (v1)
- **Tekst met directe preview schrijven**: Markdown editor (v1)
- **Verhaalintro of instructie tonen**: Digitaal bericht (C64) (v1)
- **Visuele meerkeuzevragen**: Kies de juiste afbeelding (v1)
- **Voorkennis checken**: Pubquiz Yes/No (v1)
- **Waar/onwaar-quiz**: Pubquiz Yes/No (v1)
- **Werk verdelen**: Scrumboard (v1)
- **Woordenschat en definities oefenen**: Wat hoort bij wat (v1)

## Onderhoudsafspraak

Bij een featurewijziging: pas runtime, `schema.json`, `example.json` en `catalog.json` aan; draai daarna de generator. Nieuwe toolversies vragen daarnaast om registry- en README-updates.
