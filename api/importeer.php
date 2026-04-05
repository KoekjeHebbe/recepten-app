<?php
require_once __DIR__ . '/config.php';
cors();
vereisLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Methode niet toegestaan', 405);

$data = body();
$url = trim($data['url'] ?? '');

if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) error('Ongeldige URL');
if (!preg_match('/^https?:\/\//i', $url)) error('Alleen HTTP/HTTPS URLs zijn toegestaan');

// Haal de pagina op
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "User-Agent: Mozilla/5.0 (compatible; ReceptenImporter/1.0)\r\nAccept: text/html\r\n",
        'timeout' => 10,
        'follow_location' => true,
        'max_redirects' => 5,
    ],
    'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
]);

$html = @file_get_contents($url, false, $context);
if (!$html) error('Kon de pagina niet laden. Controleer de URL.', 422);

// Zoek JSON-LD Recipe schema
preg_match_all('/<script[^>]+type=["\']?application\/ld\+json["\']?[^>]*>(.*?)<\/script>/si', $html, $matches);

$schemaRecept = null;
foreach ($matches[1] as $jsonString) {
    $obj = json_decode(trim($jsonString), true);
    if (!$obj) continue;

    // Soms zit het in een @graph array
    $kandidaten = [];
    if (isset($obj['@graph']) && is_array($obj['@graph'])) {
        $kandidaten = $obj['@graph'];
    } elseif (is_array($obj) && !isset($obj['@type'])) {
        $kandidaten = $obj; // array van objecten
    } else {
        $kandidaten = [$obj];
    }

    foreach ($kandidaten as $item) {
        $type = $item['@type'] ?? '';
        if ($type === 'Recipe' || (is_array($type) && in_array('Recipe', $type))) {
            $schemaRecept = $item;
            break 2;
        }
    }
}

if (!$schemaRecept) error('Geen receptgegevens gevonden op deze pagina. Probeer een andere URL.', 422);

// --- Titel ---
$titel = strip_tags($schemaRecept['name'] ?? '');

// --- Personen ---
$yield = $schemaRecept['recipeYield'] ?? 4;
if (is_array($yield)) $yield = $yield[0] ?? 4;
$personen = max(1, (int) preg_replace('/[^\d]/', '', (string) $yield) ?: 4);

// --- Afbeelding ---
$afbeelding = $schemaRecept['image'] ?? null;
if (is_array($afbeelding)) {
    $afbeelding = $afbeelding['url'] ?? ($afbeelding[0] ?? null);
    if (is_array($afbeelding)) $afbeelding = $afbeelding['url'] ?? null;
}
$afbeelding = is_string($afbeelding) ? $afbeelding : null;

// --- Ingrediënten ---
$ingredienten = [];
foreach ((array) ($schemaRecept['recipeIngredient'] ?? []) as $ing) {
    if (is_string($ing) && trim($ing)) {
        $ingredienten[] = ['naam' => trim(strip_tags($ing)), 'hoeveelheid' => null, 'voorraadkast' => false];
    }
}

// --- Bereiding ---
$bereiding = [];
foreach ((array) ($schemaRecept['recipeInstructions'] ?? []) as $stap) {
    if (is_string($stap) && trim($stap)) {
        $bereiding[] = trim(strip_tags($stap));
    } elseif (is_array($stap)) {
        $tekst = $stap['text'] ?? $stap['name'] ?? '';
        if (trim($tekst)) $bereiding[] = trim(strip_tags($tekst));
    }
}

// --- Voedingswaarden ---
$cal = $kh = $eiw = $vet = 0;
if (isset($schemaRecept['nutrition']) && is_array($schemaRecept['nutrition'])) {
    $n = $schemaRecept['nutrition'];
    $cal = (int) preg_replace('/[^\d]/', '', (string) ($n['calories'] ?? '0'));
    $kh  = (int) preg_replace('/[^\d]/', '', (string) ($n['carbohydrateContent'] ?? '0'));
    $eiw = (int) preg_replace('/[^\d]/', '', (string) ($n['proteinContent'] ?? '0'));
    $vet = (int) preg_replace('/[^\d]/', '', (string) ($n['fatContent'] ?? '0'));
}

json([
    'titel'        => $titel,
    'personen'     => $personen,
    'afbeelding_url' => $afbeelding,
    'bron_url'     => $url,
    'tags'         => [],
    'ingredienten' => $ingredienten,
    'bereiding'    => $bereiding,
    'voedingswaarden' => [
        'per_portie' => ['calorieen' => $cal, 'koolhydraten' => $kh, 'eiwitten' => $eiw, 'vetten' => $vet],
        'totaal'     => ['calorieen' => $cal * $personen, 'koolhydraten' => $kh * $personen, 'eiwitten' => $eiw * $personen, 'vetten' => $vet * $personen],
        'schatting'  => true,
    ],
]);
