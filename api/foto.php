<?php
require_once __DIR__ . '/config.php';
cors();
vereisLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Methode niet toegestaan', 405);
if (!defined('GOOGLE_API_KEY') || !GOOGLE_API_KEY) error('Foto-import niet geconfigureerd op de server', 503);

$data = body();
$base64 = $data['afbeelding'] ?? '';
$mediaType = $data['media_type'] ?? 'image/jpeg';

if (!$base64) error('Geen afbeelding meegestuurd');
if (!in_array($mediaType, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'])) error('Ongeldig afbeeldingsformaat');
if (strlen($base64) > 5_500_000) error('Afbeelding te groot (max ~4MB)');

$prompt = <<<'PROMPT'
Dit is een foto/schermafbeelding van een recept. Extraheer het recept, VERTAAL alles naar het Nederlands en geef het terug als JSON in exact dit formaat:

{
  "titel": "Naam van het gerecht",
  "personen": 4,
  "ingredienten": [
    { "naam": "kipfilet", "hoeveelheid": 500, "eenheid": "g", "voorraadkast": false, "groep": "Burgers" },
    { "naam": "olijfolie", "hoeveelheid": 2, "eenheid": "el", "voorraadkast": true, "groep": "Burgers" }
  ],
  "bereiding": [
    "Verwarm de oven voor op 180°C.",
    "Meng alle ingrediënten..."
  ],
  "voedingswaarden": {
    "per_portie": { "calorieen": 450, "koolhydraten": 30, "eiwitten": 35, "vetten": 18 },
    "schatting": true
  }
}

Regels:
- TAAL: titel, ingrediëntnamen en bereidingsstappen ALTIJD in het Nederlands, ook als de foto Engels (of een andere taal) is. Behoud merknamen onveranderd.
- hoeveelheid: een GETAL (geen string) of null als niet vermeld. Fracties als decimalen: 1/2 → 0.5, 1/4 → 0.25, ¼ → 0.25, ½ → 0.5. Bij een bereik ("½–1 tl", "520–560 ml") neem je het gemiddelde of de eerste waarde.
- eenheid: EXACT een van deze codes, of lege string: [g, kg, ml, l, el, tl, kl, cup, stuk, teen, plak, sneetje, handvol, snufje]. Gebruik de code, niet het woord (dus "g" niet "gram", "el" niet "eetlepel", "tl" niet "theelepel").
  Engelse eenheden omzetten: tbsp → el, tsp → tl, clove → teen, slice → plak, pinch → snufje, piece → stuk.
  Imperial → metric: 1 lb ≈ 454 g, 1 oz ≈ 28 g, 1 fl oz ≈ 30 ml, 1 quart ≈ 950 ml, 1 pint ≈ 470 ml.
- naam = KORT en kaal: alleen het ingrediënt zelf, zonder hoeveelheid en zonder bereidingsomschrijving. "Onion — 150 g, diced" wordt {"naam":"ui","hoeveelheid":150,"eenheid":"g"}; "Chicken thighs, boneless & skinless — 450 g, cut into pieces" wordt {"naam":"kipdijfilet","hoeveelheid":450,"eenheid":"g"}. Snijwijze/bereiding hoort in de bereidingsstappen, niet in de naam (korte namen zijn nodig voor de macro-database en de boodschappenlijst).
- voorraadkast = true voor: olie, azijn, zout, peper, kruiden, specerijen, bloem, suiker, boter
- groep = de sectiekop waaronder het ingrediënt staat (bijv. "Burgers", "Slaw", "Saus"). Als het recept de ingrediënten onder kopjes groepeert, zet de juiste kop bij elk ingrediënt; anders lege string "". Verzin geen secties.
- bereiding: elke stap als aparte, volledig uitgeschreven Nederlandse zin. Laat stapnummers weg.
- voedingswaarden: als de foto macros vermeldt, gebruik die. Anders bereken zelf een realistische schatting op basis van de ingrediënten en hoeveelheden. Zet schatting altijd op true tenzij de foto expliciete voedingswaarden vermeldt.
- calorieen, koolhydraten, eiwitten, vetten zijn altijd gehele getallen (afgerond)
- Antwoord ALLEEN met de JSON, geen uitleg errond
PROMPT;

$payload = json_encode([
    'contents' => [[
        'parts' => [
            [
                'inline_data' => [
                    'mime_type' => $mediaType,
                    'data' => $base64,
                ],
            ],
            ['text' => $prompt],
        ],
    ]],
    'generationConfig' => [
        'temperature' => 0.1,
        // flash-lite "denkt" niet, dus de tokens gaan naar de JSON; ruim budget
        // zodat langere recepten niet afgekapt worden. responseMimeType dwingt
        // zuivere JSON af (geen markdown-codeblok).
        'maxOutputTokens' => 8192,
        'responseMimeType' => 'application/json',
    ],
]);

// flash-lite denkt niet (geen truncatie) en is primair; bij drukte (503) vallen we
// terug op flash (aparte capaciteit). Elk model enkele pogingen met backoff.
$antwoord = false;
$httpCode = 0;
foreach (['gemini-2.5-flash-lite', 'gemini-2.5-flash'] as $model) {
    $apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=" . GOOGLE_API_KEY;
    for ($poging = 0; $poging < 2; $poging++) {
        $ch = curl_init($apiUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        ]);
        $antwoord = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($antwoord && $httpCode === 200) break 2;
        if ($poging < 1) usleep(700000 * ($poging + 1)); // 0.7s, 1.4s
    }
}

if (!$antwoord) error('Kon de AI-service niet bereiken', 503);

$antwoordData = json_decode($antwoord, true);
if ($httpCode !== 200) {
    $msg = $antwoordData['error']['message'] ?? 'Onbekende fout bij AI-service';
    error('AI-fout: ' . $msg, 502);
}

// Pak de eerste non-thought part (Gemini 2.5 kan thinking-tokens teruggeven)
$parts = $antwoordData['candidates'][0]['content']['parts'] ?? [];
$tekst = '';
foreach ($parts as $part) {
    if (!empty($part['text']) && empty($part['thought'])) {
        $tekst = $part['text'];
        break;
    }
}
if (!$tekst) error('Geen antwoord ontvangen van AI-service', 502);

// Extraheer JSON — zoek eerste { tot laatste }
$tekst = trim($tekst);
$start = strpos($tekst, '{');
$einde = strrpos($tekst, '}');
if ($start !== false && $einde !== false && $einde > $start) {
    $tekst = substr($tekst, $start, $einde - $start + 1);
} else {
    // Fallback: strip markdown code blocks
    $tekst = preg_replace('/^```(?:json)?\s*/i', '', $tekst);
    $tekst = preg_replace('/\s*```$/i', '', $tekst);
}

$recept = json_decode(trim($tekst), true);
if (!$recept || empty($recept['titel'])) error('Kon geen recept herkennen in de afbeelding. Probeer een duidelijkere foto.', 422);

// Vangnet: eenheid terugbrengen naar een canonieke code die de frontend kent.
// (Zelfde mapping als in importeer.php; endpoints draaien nooit samen.)
function fotoCanoniseerEenheid(string $e): string {
    $e = strtolower(trim($e));
    if ($e === '') return '';
    static $map = [
        'g'=>'g','gram'=>'g','grammen'=>'g','gr'=>'g',
        'kg'=>'kg','kilo'=>'kg','kilogram'=>'kg',
        'ml'=>'ml','milliliter'=>'ml',
        'l'=>'l','liter'=>'l','ltr'=>'l',
        'el'=>'el','eetlepel'=>'el','eetlepels'=>'el','tbsp'=>'el','tablespoon'=>'el',
        'tl'=>'tl','theelepel'=>'tl','theelepels'=>'tl','tsp'=>'tl','teaspoon'=>'tl',
        'kl'=>'kl','koffielepel'=>'kl',
        'cup'=>'cup','cups'=>'cup','kop'=>'cup',
        'stuk'=>'stuk','stuks'=>'stuk','st'=>'stuk','piece'=>'stuk','pieces'=>'stuk',
        'teen'=>'teen','tenen'=>'teen','teentje'=>'teen','teentjes'=>'teen','clove'=>'teen','cloves'=>'teen',
        'plak'=>'plak','plakken'=>'plak','plakje'=>'plak','plakjes'=>'plak','slice'=>'plak','slices'=>'plak',
        'sneetje'=>'sneetje','sneetjes'=>'sneetje','snee'=>'sneetje',
        'handvol'=>'handvol','handje'=>'handvol','handful'=>'handvol',
        'snufje'=>'snufje','snuf'=>'snufje','pinch'=>'snufje',
    ];
    return $map[$e] ?? '';
}

// Normaliseer ingrediënten: getal + canonieke eenheid, ook als het model toch
// een string ("500 g") of een uitgeschreven eenheid ("gram") teruggeeft.
$genormaliseerdeIngr = [];
foreach (($recept['ingredienten'] ?? []) as $ing) {
    if (!is_array($ing)) continue;
    $naam = trim((string)($ing['naam'] ?? ''));
    if ($naam === '') continue;

    $hoeveelheid = null;
    $eenheid     = fotoCanoniseerEenheid((string)($ing['eenheid'] ?? ''));

    if (isset($ing['hoeveelheid']) && is_numeric($ing['hoeveelheid'])) {
        $hoeveelheid = (float)$ing['hoeveelheid'];
    } elseif (!empty($ing['hoeveelheid']) && is_string($ing['hoeveelheid'])) {
        // Oud formaat: "500 g", "2 el", "1 teen"
        $s = str_replace(',', '.', trim($ing['hoeveelheid']));
        if (preg_match('/^([\d.]+)\s*([a-zA-Z]+)?/', $s, $m)) {
            $hoeveelheid = (float)$m[1];
            if ($eenheid === '' && !empty($m[2])) $eenheid = fotoCanoniseerEenheid($m[2]);
        }
    }

    $groep = trim((string)($ing['groep'] ?? ''));
    $genormaliseerdeIngr[] = [
        'naam'         => $naam,
        'hoeveelheid'  => $hoeveelheid,
        'eenheid'      => $eenheid,
        'voorraadkast' => (bool)($ing['voorraadkast'] ?? false),
    ] + ($groep !== '' ? ['groep' => $groep] : []);
}
if (!empty($genormaliseerdeIngr)) $recept['ingredienten'] = $genormaliseerdeIngr;

// Normaliseer structuur
$recept['tags'] = [];
$recept['bron_url'] = null;
$recept['afbeelding_url'] = null;
if (!isset($recept['voedingswaarden']['totaal'])) {
    $pp = $recept['voedingswaarden']['per_portie'] ?? ['calorieen' => 0, 'koolhydraten' => 0, 'eiwitten' => 0, 'vetten' => 0];
    $p = $recept['personen'] ?? 4;
    $recept['voedingswaarden']['totaal'] = [
        'calorieen'     => ($pp['calorieen'] ?? 0) * $p,
        'koolhydraten'  => ($pp['koolhydraten'] ?? 0) * $p,
        'eiwitten'      => ($pp['eiwitten'] ?? 0) * $p,
        'vetten'        => ($pp['vetten'] ?? 0) * $p,
    ];
}
if (!isset($recept['voedingswaarden']['schatting'])) {
    $recept['voedingswaarden']['schatting'] = true;
}

json($recept);
