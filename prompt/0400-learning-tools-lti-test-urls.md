# Learning Tools: LTI Test URL Plan (No Admin / No Developer Key)

## Doel
In de public_html map tref je onder types een serie interactieve leer tools 
die ik gebruik binnen http://courses.nuidev.nl en https://courses.devroc.nl. 
Vanuit deze twee systemen push ik de pagina's die ik aanmaak, waar deze 
learn tools onderdeel van uitmaken richting het Canvas LMS. Binnen Canvas 
laden die tools op dit moment in als een iframe. Ik zou graag willen dat 
deze tools als external_tool binnen Canvas geregistreerd worden. Hiervoor 
wil ik `submission_types=["external_tool"]` laten verwijzen naar een van de 
tools binnen dit systeem. Omdat het onduidelijk is wat mijn mogelijkheden 
zijn zonder admin rechten of developer key wil ik graag per tool een aantal 
van de door het Canvas Instructure systeem ondersteunde standaarden formats 
hebben om te experimenteren om bijvoorbeeld te kunnen achterhalen of Canvas 
de tool oppakt, welke gegevens ik vanuit Canvas binnen krijg en welke 
gegevens / ratings ik terug kan sturen naar het systeem. 

## Randvoorwaarden
- Geen Canvas account-admin rechten.
- Geen Developer Key beheer.
- Doel: vooral eenvoudige, course-level tests via External Tool config by URL/XML.
- Voorkeur: geen runtime afhankelijkheid van `courses.devroc.nl`, het json 
  configuratiebestand komt in de productie situatie vanuit het Canvas LMS en 
  mag voor de test vanuit dit systeem lokaal komen.

## Verwachtte output
Op de voorpagina van dit systeem staat een opsomming van alle learn tools 
die op dit moment beschikbaar zijn. Ik zou graag willen dat je daar per 
learn tool een of meerdere config LTI XML url's aan toevoegt. Ik zal die 
URL's dan zelf even handmatig in een assigment plakken met 
`submission_types=["external_tool"]` om te kijken of het werkt. 

Omdat er verschillende LTI versies zijn zou het misschien fijn zijn als je 
ook verschillende url's maakt om te testen.

### Debug learn tool
De server waarop dit systeem staat heeft PHP8.4 draaien, misschien is het 
nuttig om een debug tooltje te maken at ik als eerste kan proberen, dit 
tooltje zou dan gegevens die vanuit Canvas worden aangeboden kunnen laten 
zien en ik zou dan met een formuliertje gegevens terug kunnen sturen?

## Verwachte Canvas-route zonder admin
Gebruik vooral:
1. Course-level External Tool toevoegen via URL/XML (indien rol dit toelaat).
2. Assignment met `submission_types=["external_tool"]` laten verwijzen naar die tool.
3. Start met launch/context tests; grading/passback pas later (of alleen als bestaande LTI setup dat al ondersteunt).

## Te bouwen in learning-tools project
Implementeer een test-laag met vaste URL-structuur per tool.

## 1) Launch URL (altijd)
- `https://learning-tools.nuidev.nl/types/{tool_slug}/lti/launch`

Gedrag:
- Accepteer normale query/custom params zoals `data`, `unique_id`, `user_id`, `course_id`.
- Render debug-info veilig (geen secrets), plus tool-UI.
- Als `data` ontbreekt: laad lokale mock data uit eigen project.

## 2) Config URL per tool (LTI XML, voor by_url tests)
- `https://learning-tools.nuidev.nl/types/{tool_slug}/lti/launch`

Minimale inhoud:
- Title/description per tool.
- Launch URL verwijst naar `/types/{tool_slug}/lti/launch`.
- Genereer verschillende URL's voor verschillende privacy levels, ik wil 
  gebruik gaan maken van de minst restrictieve variant die mogelijk is in 
  mijn situaite. 
- Custom parameters:
1. `tool_slug={tool_slug}`
2. `unique_id=$Canvas.user.id-{tool_slug}-test`
3. Gebruik de sample data uit example.json als mock-data of maak een nieuw 
   json bestand aan in `/types/{tool_slug}/lti/mock-data.json` indien nodig.
4. Probeer in `docs/lti-test-urls.md` vast te leggen wat voor soort rating elk van de url 
   standaarden terug kan sturen naar het Canvas LMS, indien van toepassing.
5. Voeg een korte smoke-test instructie toe aan `docs/lti-test-urls.md`