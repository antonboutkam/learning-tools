# Canvas inzendingen vanuit een iframe (LTI 1.3)

Een los iframe kan **niet** direct een inzending of score in Canvas registreren. Voor echte inleveringen en/of cijfers moet je tool een **LTI 1.3/Advantage**‑integratie hebben en een **LTI‑launch** ontvangen. Daarna kan je server‑side een score of submission registreren via **Assignment & Grading Services (AGS)**.

## Korte samenvatting
- **Iframe zonder LTI‑launch**: alleen weergave, geen inzending/score.
- **LTI 1.3 tool**: Canvas start een OIDC‑launch in de iframe.
- **AGS**: tool stuurt score terug naar Canvas (gradebook).

## Welke plaatsing heb je nodig?
- **assignment_selection**: docent kiest tool als opdracht; studenten openen de opdracht (iframe) en jij post scores via AGS.
- **link_selection**: module‑item zonder gradebook‑koppeling (handig voor content).
- **homework_submission**: student kiest tool om een **bestand** in te leveren voor een “Online File Upload” opdracht (deep linking flow).

## Vereiste onderdelen (hoog niveau)
1. **LTI 1.3 registratie in Canvas**
   - Developer Key + External App configuratie.
   - Placements toevoegen (minimaal `assignment_selection`).
2. **OIDC login + LTI launch**
   - Endpoints: `oidc_initiation_url`, `redirect_uri` (launch), `jwks_url`.
   - Validatie van JWT (issuer, audience, nonce, state).
3. **AGS (Assignment & Grading Services)**
   - OAuth2 token ophalen met `client_credentials`.
   - Line item aanmaken of hergebruiken.
   - Score posten naar Canvas.

## Flow (vereenvoudigd)
1. Docent kiest tool bij het aanmaken van een opdracht (assignment_selection + deep linking).
2. Canvas launcht de tool in een iframe met LTI‑claim(s).
3. Tool toont de opdracht (jouw quiz).
4. Student rondt af.
5. Tool post score naar Canvas via AGS.

## Praktische implicaties voor dit project
- De huidige “standalone” quiz‑types blijven bruikbaar voor preview/iframe.
- Voor **echte inzendingen** moet je een server‑side LTI 1.3 laag toevoegen.
- Je kunt de quiz‑type URL in je LTI‑launch pagina embedden, maar de **score** moet via AGS vanuit de server worden gepost.

## Handige Canvas docs
- LTI Launch Overview: https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_launch_overview
- Deep Linking (Content‑Item): https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.content_item
- Assignment Selection placement: https://www.canvas.instructure.com/doc/api/file.assignment_selection_placement.html
- Configuring LTI 1.3 tools: https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_dev_key_config
- Homework submission placement: https://www.canvas.instructure.com/doc/api/file.homework_submission_placement.html

## Open vragen voor implementatie
- Wil je alleen een **score** terugsturen, of ook een **submission artifact** (bestand/tekst)?
- Is er admin‑toegang om de LTI 1.3 Developer Key te registreren?
- Welke backend (Node/PHP/… ) ga je gebruiken voor OIDC en AGS?

---

## Implementatie‑checklist (PHP)

### 1) Project‑structuur
- Maak een kleine webapp met routes voor:
  - `/oidc/init` (OIDC initiation)
  - `/lti/launch` (LTI launch redirect/POST)
  - `/lti/deeplink` (Deep Linking response)
  - `/ags/score` (score posten na afronding)

### 2) Config en sleutels
- Genereer een RSA keypair (private key op server, public key in JWKS).
- Publiceer JWKS via `/jwks.json`.
- Sla Canvas‑config op:
  - `client_id`, `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`

### 3) OIDC initiation
- Valideer inkomende parameters `iss`, `login_hint`, `target_link_uri`, `client_id`.
- Sla `state` en `nonce` op in server‑side session (of secure store).
- Redirect naar `authorization_endpoint` met OIDC params.

### 4) LTI launch
- Accepteer de POST met `id_token`.
- Valideer JWT:
  - issuer, audience, nonce, exp, iat, signature tegen Canvas JWKS.
- Lees claims:
  - `https://purl.imsglobal.org/spec/lti/claim/message_type`
  - `https://purl.imsglobal.org/spec/lti/claim/roles`
  - `https://purl.imsglobal.org/spec/lti-ags/claim/endpoint`
- Sla context op (user, course, lineitems URL).

### 5) Deep Linking (docent)
- Als `message_type` = `LtiDeepLinkingRequest`:
  - Bouw een Deep Linking response (JWT) met `content_items`.
  - Post terug naar `deep_link_return_url`.

### 6) AGS (score posten)
- Haal OAuth2 token op met `client_credentials` scope:
  - `https://purl.imsglobal.org/spec/lti-ags/scope/score`
  - `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem`
- Maak of vind line item via `lineitems` endpoint.
- Post score (JSON):
  - `scoreGiven`, `scoreMaximum`, `activityProgress`, `gradingProgress`, `userId`.

### 7) Koppeling met jouw quiz‑types
- Embed jouw quiz‑URL in de LTI launch page (iframe of redirect).
- Bij afronding: POST score naar `/ags/score` op je server.

### 8) Beveiliging en compliance
- Gebruik HTTPS overal.
- Bewaar tokens kort en veilig.
- Log geen volledige JWT’s in productie.

### 9) Minimale PHP‑libs (suggestie)
- JWT: `firebase/php-jwt` of `lcobucci/jwt`
- HTTP client: `guzzlehttp/guzzle`

---

## Voorbeeld Developer Key config (Canvas)
- Voorbeeld JSON: `docs/lti-config-example.json`
- Vul je eigen domein, key‑gegevens en `public_jwk` in.

---

## PHP code‑skelet (minimaal)

> Dit is een minimale schets om structuur te tonen. Voeg echte validatie, opslag en foutafhandeling toe.

```
<?php

require __DIR__ . '/vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\JWK;
use GuzzleHttp\Client;

session_start();

$config = [
  'client_id' => 'YOUR_CLIENT_ID',
  'issuer' => 'https://canvas.instructure.com',
  'auth_endpoint' => 'https://canvas.instructure.com/api/lti/authorize_redirect',
  'token_endpoint' => 'https://canvas.instructure.com/login/oauth2/token',
  'jwks_uri' => 'https://canvas.instructure.com/api/lti/security/jwks',
  'redirect_uri' => 'https://your-domain.example/lti/launch',
  'tool_public_jwks' => 'https://your-domain.example/jwks.json'
];

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($path === '/oidc/init') {
  $iss = $_GET['iss'] ?? '';
  $loginHint = $_GET['login_hint'] ?? '';
  $targetLinkUri = $_GET['target_link_uri'] ?? '';
  $clientId = $_GET['client_id'] ?? '';

  // Store state + nonce
  $state = bin2hex(random_bytes(16));
  $nonce = bin2hex(random_bytes(16));
  $_SESSION['state'] = $state;
  $_SESSION['nonce'] = $nonce;
  $_SESSION['target_link_uri'] = $targetLinkUri;

  $params = http_build_query([
    'scope' => 'openid',
    'response_type' => 'id_token',
    'client_id' => $clientId,
    'redirect_uri' => $config['redirect_uri'],
    'login_hint' => $loginHint,
    'state' => $state,
    'response_mode' => 'form_post',
    'nonce' => $nonce,
    'prompt' => 'none'
  ]);

  header('Location: ' . $config['auth_endpoint'] . '?' . $params);
  exit;
}

if ($path === '/lti/launch') {
  $idToken = $_POST['id_token'] ?? '';
  $state = $_POST['state'] ?? '';

  if (!$idToken || $state !== ($_SESSION['state'] ?? '')) {
    http_response_code(400);
    echo 'Invalid state or token';
    exit;
  }

  // Fetch Canvas JWKS and validate JWT
  $http = new Client();
  $jwks = json_decode($http->get($config['jwks_uri'])->getBody(), true);
  $keys = JWK::parseKeySet($jwks);

  $decoded = JWT::decode($idToken, $keys);

  // Example: read AGS endpoint
  $ags = $decoded->{'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'} ?? null;

  // Render launch page (embed quiz iframe)
  echo '<html><body>';
  echo '<h1>Launch ok</h1>';
  echo '<iframe src="https://your-domain.example/types/juiste-volgorde/v1/?course_id=COURSE123&assignment_id=ASSIGN456&data=https%3A%2F%2F..." width="100%" height="700"></iframe>';
  echo '</body></html>';
  exit;
}

// Add /ags/score route to post scores using OAuth2 token.
```

### JWKS endpoint (`/jwks.json`)
Publiceer je public key(s) zodat Canvas je tokens kan verifiëren.

```
if ($path === '/jwks.json') {
  header('Content-Type: application/json');
  echo json_encode([
    'keys' => [[
      'kty' => 'RSA',
      'kid' => 'replace-with-your-kid',
      'use' => 'sig',
      'alg' => 'RS256',
      'n' => 'replace-with-your-modulus',
      'e' => 'AQAB'
    ]]
  ]);
  exit;
}
```

### Deep Linking response (`/lti/deeplink`)
Stuur een Deep Linking response terug naar Canvas na selectie in de UI.

```
if ($path === '/lti/deeplink') {
  $deepLinkReturnUrl = $_POST['deep_link_return_url'] ?? '';
  $deployId = $_POST['deployment_id'] ?? '';

  $jwt = JWT::encode([
    'iss' => $config['client_id'],
    'aud' => $config['issuer'],
    'nonce' => bin2hex(random_bytes(12)),
    'iat' => time(),
    'exp' => time() + 300,
    'https://purl.imsglobal.org/spec/lti/claim/message_type' => 'LtiDeepLinkingResponse',
    'https://purl.imsglobal.org/spec/lti/claim/version' => '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id' => $deployId,
    'https://purl.imsglobal.org/spec/lti-dl/claim/content_items' => [[
      'type' => 'ltiResourceLink',
      'title' => 'Learning Tools quiz',
      'url' => 'https://your-domain.example/lti/launch',
      'custom' => [
        'launch_url' => 'https://your-domain.example/types/juiste-volgorde/v1/?course_id=COURSE123&assignment_id=ASSIGN456&data=https%3A%2F%2F...'
      ]
    ]]
  ], file_get_contents(__DIR__ . '/keys/private.pem'), 'RS256', 'replace-with-your-kid');

  echo '<form method="post" action="' . htmlspecialchars($deepLinkReturnUrl) . '">';
  echo '<input type="hidden" name="JWT" value="' . htmlspecialchars($jwt) . '">';
  echo '<button type="submit">Return</button>';
  echo '</form>';
  exit;
}
```

### AGS score posten (`/ags/score`)
Post scores server‑side nadat een student klaar is.

```
if ($path === '/ags/score' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $body = json_decode(file_get_contents('php://input'), true);
  $lineitemsUrl = $body['lineitems_url'] ?? '';
  $userId = $body['user_id'] ?? '';
  $scoreGiven = $body['score_given'] ?? 0;
  $scoreMaximum = $body['score_max'] ?? 1;

  // 1) OAuth2 token (client_credentials)
  $http = new Client();
  $tokenRes = $http->post($config['token_endpoint'], [
    'form_params' => [
      'grant_type' => 'client_credentials',
      'client_id' => $config['client_id'],
      'client_secret' => 'YOUR_CLIENT_SECRET',
      'scope' => implode(' ', [
        'https://purl.imsglobal.org/spec/lti-ags/scope/score',
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem'
      ])
    ]
  ]);
  $tokenJson = json_decode($tokenRes->getBody(), true);
  $accessToken = $tokenJson['access_token'] ?? '';

  // 2) Create line item (optional) - for simplicity, use first lineitem if exists
  $lineitemsRes = $http->get($lineitemsUrl, [
    'headers' => ['Authorization' => 'Bearer ' . $accessToken]
  ]);
  $lineitems = json_decode($lineitemsRes->getBody(), true);
  $lineitemUrl = $lineitems[0]['id'] ?? $lineitemsUrl;

  // 3) Post score
  $scoreUrl = rtrim($lineitemUrl, '/') . '/scores';
  $scoreBody = [
    'userId' => $userId,
    'scoreGiven' => $scoreGiven,
    'scoreMaximum' => $scoreMaximum,
    'activityProgress' => 'Completed',
    'gradingProgress' => 'FullyGraded'
  ];

  $http->post($scoreUrl, [
    'headers' => [
      'Authorization' => 'Bearer ' . $accessToken,
      'Content-Type' => 'application/vnd.ims.lis.v1.score+json'
    ],
    'json' => $scoreBody
  ]);

  header('Content-Type: application/json');
  echo json_encode(['ok' => true]);
  exit;
}
```
