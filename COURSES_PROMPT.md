# Prompt instructies voor Courses (of andere leertools)

Doel: laat Codex een externe leertool configureren die dynamisch quiz‑types kan ophalen uit een centrale registry, per type een formulier genereert op basis van JSON Schema, en een iframe‑URL bouwt die een quiz laadt met een `data`‑URL.

## Context voor Codex
- Er is een set **standalone quiz‑types** beschikbaar in versie‑mappen.
- Elk type heeft:
  - `launchUrl` (iframe‑doel)
  - `schemaUrl` (JSON Schema)
  - `exampleDataUrl` (voorbeeld)
- Een centrale registry levert alle quiz‑types.

## Opdracht voor Codex (stap‑voor‑stap)
1. **Haal de registry op**
   - Fetch de JSON‑registry (bijv. `/types/registry.json`).
   - Cache de response, maar zorg dat de gebruiker kan refreshen.

2. **Toon beschikbare quiz‑types**
   - Lees `types[]` uit de registry.
   - Presenteer `name`, `description`, `version`.

3. **Laad schema per type**
   - Wanneer een type wordt geselecteerd: fetch `schemaUrl`.
   - Genereer een formulier op basis van JSON Schema (draft 2020‑12).
   - Respecteer `required`, `default`, `minItems`, `additionalProperties: false`.

4. **Bouw data‑JSON**
   - Serialize het formulier naar JSON die aan het schema voldoet.
   - Valideer vóór opslaan of preview.

5. **Publiceer data‑JSON**
   - Sla de JSON op een publiek bereikbare URL op (met CORS toegestaan).
   - Bewaar deze URL als `dataUrl`.

6. **Bouw de iframe‑URL**
   - Gebruik `launchUrl` van het type.
   - Voeg query toe: `?data=<urlencode(dataUrl)>`.
   - Voorbeeld: `/types/juiste-volgorde/v1/?data=https%3A%2F%2Fcdn.example.nl%2Fquiz%2F123.json`

7. **Embed in Canvas**
   - Render in een iframe (Canvas staat iframes toe).
   - Zorg dat de iframe de volledige breedte gebruikt en een redelijke hoogte heeft (bv. 600–800px).

## Technische vereisten
- JSON Schema: 2020‑12.
- Output JSON moet exact voldoen aan `additionalProperties: false`.
- CORS: `dataUrl` moet fetchbaar zijn door de quiz‑pagina.
- Versioning: gebruik altijd `launchUrl` met versie, bv. `/v1/`.

## Verwachte registry‑structuur (voorbeeld)
```json
{
  "version": 1,
  "types": [
    {
      "id": "juiste-volgorde",
      "name": "Juiste volgorde",
      "version": "v1",
      "launchUrl": "/types/juiste-volgorde/v1/",
      "schemaUrl": "/types/juiste-volgorde/v1/schema.json",
      "exampleDataUrl": "/types/juiste-volgorde/v1/example.json",
      "description": "Sorteer elementen in de juiste volgorde."
    }
  ]
}
```

## Voorbeeld workflow in Courses
1. Selecteer type **Juiste volgorde**.
2. Formulier verschijnt (gegenereerd uit `schema.json`).
3. Vul items in (met `id` en `text`).
4. Opslaan -> JSON gepubliceerd op CDN.
5. Courses maakt iframe‑URL met `?data=`.
6. In Canvas verschijnt de opdracht in de iframe.

## Opmerkingen voor Codex
- Gebruik geen inline JS in Canvas; alleen iframe embed.
- Valideer JSON lokaal vóór publicatie.
- Houd rekening met netwerkfouten (toon duidelijke foutmelding).
- Ondersteun meerdere versies van hetzelfde type.

---

## Kopieer‑klare korte prompt (voor in een prompt‑veld)

```
Je bent Codex in de Courses‑tool. Implementeer een dynamische quiz‑builder die quiz‑types ophaalt uit een registry en per type een formulier genereert op basis van JSON Schema (draft 2020‑12). 

Taken:
1) Fetch `/types/registry.json` en toon de types in het UI‑menu “Quiz types”.
2) Bij selectie: fetch `schemaUrl` en genereer het formulier automatisch.
3) Respecteer `required`, `default`, `minItems`, `additionalProperties:false`.
4) Serialize formulier → JSON, valideer tegen het schema.
5) Publiceer JSON naar een publiek bereikbare URL (CORS toegestaan).
6) Bouw iframe‑URL: `${launchUrl}?data=${encodeURIComponent(dataUrl)}`.
7) Toon preview (iframe) en geef embed‑snippet terug.

UI‑structuur:
- Linker kolom: type‑selectie + beschrijving.
- Midden: formulier met duidelijke veldlabels en hulptekst uit schema.
- Rechter kolom: live preview + JSON output.

Formulier‑ontwerp:
- Gebruik veldlabels uit `title`/`description` indien aanwezig.
- Voor arrays: toon “Voeg item toe” + herordenen.
- Valideer inline en toon foutmelding bij het veld.

Gebruik versies altijd via `launchUrl` met `/v1/`.
```

## UI‑koppeling voor extra context (optioneel)
- Plaats de quiz‑builder onder het kopje **Leertools → Quiz types**.
- Toon bovenaan een korte uitleg: “Selecteer een quiz‑type en vul het formulier in. De tool publiceert JSON en genereert een iframe‑URL voor Canvas.”

---

## Promptvariant: formulier‑ontwerp (uitgebreid)

```
Je bent Codex in de Courses‑tool. Ontwerp het formulier‑UI voor quiz‑types op basis van JSON Schema (draft 2020‑12) met duidelijke labels, hulpteksten en validatie. Gebruik onderstaande regels.

Formulier‑UI regels:
- Gebruik `title` als veldlabel; val terug op property‑naam.
- Toon `description` als helptekst onder het veld.
- `required` => markeer veld als verplicht.
- `default` => prefill.
- `minItems`/`maxItems` => toon limiet in helptekst.
- `additionalProperties:false` => geen vrije velden.

Veld‑mapping:
- string => tekstveld
- number/integer => numeriek veld
- boolean => checkbox / toggle
- enum => select
- array<object> => herhaalbare sectie met “Voeg item toe” + herordenen
- array<string/number> => herhaalbare lijst
- object => group/fieldset

Validatie:
- Live validatie per veld (on blur en on change)
- Fouten tonen direct onder het veld
- Blokkeer publiceren/preview als schema‑validatie faalt

UX‑structuur:
- Linker kolom: type‑selectie en uitleg
- Midden: formulier
- Rechter kolom: JSON‑preview + iframe‑preview

Output:
- Genereer geldige JSON volgens schema
- Publiceer JSON naar `dataUrl`
- Bouw iframe‑URL: `${launchUrl}?data=${encodeURIComponent(dataUrl)}`
```
