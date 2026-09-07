# Digitaal bericht v2

Kale terminal zonder afzenderblok, kop, badges of knoppen. Open `index.html?data=<JSON-URL>` via HTTP(S). `text` is verplicht; overige velden staan in `schema.json`. Iedere tekstregel begint met `$`, ook bij het afbreken van lange regels op mobiel. Tussen alinea’s met een lege regel in de berichttekst staat één aparte regel met `$`. Automatisch afgebroken regels sluiten direct op elkaar aan.

Het scherm vult de ingestelde iframehoogte en scrollt intern. Tijdens het typen volgt de weergave de laatste regel, behalve als de lezer omhoog is gescrold. Het iframe groeit niet met de tekst.

`mistakes: true` toont af en toe een verkeerde letter die met backspace wordt verwijderd, en tijdelijke extra puntjes na een punt. `mistake_rate` bepaalt de kans per letter; `speed` bepaalt het tempo. Het basistempo is gehalveerd ten opzichte van de eerdere terminalanimatie; ook correcties en aarzelingen lopen langzamer. De uiteindelijke berichttekst verandert niet. `|` verwijdert de vorige letter; `||` geeft een letterlijk pipe-teken. `cursor` regelt de cursor tijdens het typen.

`title` bepaalt uitsluitend de documenttitel. `senderLabel`, `sentLabel` en `statusLabel` worden voor compatibiliteit nog geaccepteerd, maar niet getoond. Er worden geen studentantwoorden opgehaald of opgeslagen.

Verminderde beweging toont meteen de volledige tekst. Schermlezers krijgen één volledige, gecorrigeerde tekst zonder prompts of losse toetsaanslagen. Het terminalvenster is met het toetsenbord scrollbaar. Alle inhoud wordt als tekst weergegeven.

Controle: `node runtime.test.cjs`.
