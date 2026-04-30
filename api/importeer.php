<?php
require_once __DIR__ . '/config.php';
cors();
vereisLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Methode niet toegestaan', 405);

$data = body();
$url = trim($data['url'] ?? '');

if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) error('Ongeldige URL');
if (!preg_match('/^https?:\/\//i', $url)) error('Alleen HTTP/HTTPS URLs zijn toegestaan');

// ─── TikTok: beschrijving → Gemini → gestructureerd recept ──────────────────
if (preg_match('/tiktok\.com/i', $url)) {
    $beschrijving = trim($data['beschrijving'] ?? '');

    // Stap 1: nog geen beschrijving → vraag de frontend om die te tonen
    if (!$beschrijving) {
        json(['tiktok' => true]);
    }

    // Stap 2: beschrijving ontvangen → parse met Gemini
    if (!defined('GOOGLE_API_KEY') || !GOOGLE_API_KEY) error('Google API key niet geconfigureerd', 500);

    $prompt = "Analyseer deze TikTok-videobeschrijving en extraheer het recept.\n"
        . "Als er geen duidelijk recept in staat, antwoord dan ALLEEN met het woord: GEEN_RECEPT\n\n"
        . "Beschrijving:\n" . $beschrijving . "\n\n"
        . "Geef ALLEEN een JSON-object terug (geen uitleg, geen markdown, geen codeblok):\n"
        . "{\"titel\":\"...\",\"personen\":4,\"ingredienten\":[{\"naam\":\"...\",\"hoeveelheid\":null,\"eenheid\":\"\",\"voorraadkast\":false}],\"bereiding\":[\"stap 1\",\"stap 2\"],\"tags\":[]}\n\n"
        . "Regels:\n"
        . "- titel: korte receptnaam in het Nederlands\n"
        . "- personen: aantal porties (standaard 4 als niet vermeld)\n"
        . "- ingredienten: elk ingredient apart, hoeveelheid als getal of null, eenheid uit [g,kg,ml,l,el,tl,kl,cup,stuk,teen,plak,sneetje,handvol,snufje] of lege string\n"
        . "- bereiding: array van korte, duidelijke stappen in het Nederlands\n"
        . "- tags: relevante tags uit [ontbijt,lunch,diner,snack,zoet,hartig,gezond,comfort,quick,pasta,soep,salade,ovenschotel,wok]\n"
        . "- Als de beschrijving enkel ingrediënten noemt zonder bereiding, reconstrueer dan logische bereidingsstappen";

    $payload = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['temperature' => 0.2, 'maxOutputTokens' => 4096],
    ]);
    $apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' . GOOGLE_API_KEY;
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if (!$resp) error('Kon Gemini niet bereiken.', 502);

    $respData = json_decode($resp, true);
    $parts = $respData['candidates'][0]['content']['parts'] ?? [];
    $tekst = '';
    foreach ($parts as $part) {
        if (!empty($part['text']) && empty($part['thought'])) { $tekst = $part['text']; break; }
    }

    if (stripos($tekst, 'GEEN_RECEPT') !== false) {
        error('Geen recept gevonden in de beschrijving. Plak de volledige caption met ingrediënten.', 422);
    }

    $s = strpos($tekst, '{');
    $e = strrpos($tekst, '}');
    if ($s === false || $e <= $s) error('Kon het recept niet structureren uit de beschrijving.', 422);

    $parsed = json_decode(substr($tekst, $s, $e - $s + 1), true);
    if (!$parsed || empty($parsed['titel'])) error('Kon het recept niet structureren uit de beschrijving.', 422);

    $personen     = max(1, (int)($parsed['personen'] ?? 4));
    $ingredienten = [];
    foreach (($parsed['ingredienten'] ?? []) as $ing) {
        $ingredienten[] = [
            'naam'         => $ing['naam'] ?? '',
            'hoeveelheid'  => isset($ing['hoeveelheid']) && is_numeric($ing['hoeveelheid']) ? (float)$ing['hoeveelheid'] : null,
            'eenheid'      => $ing['eenheid'] ?? '',
            'voorraadkast' => (bool)($ing['voorraadkast'] ?? false),
        ];
    }

    // Voedingswaarden schatten via Gemini
    $cal = $kh = $eiw = $vet = 0;
    if (!empty($ingredienten)) {
        $ingLijst = implode(', ', array_map(fn($i) => ($i['hoeveelheid'] ? $i['hoeveelheid'] . ' ' . $i['eenheid'] . ' ' : '') . $i['naam'], $ingredienten));
        $vraag = "Bereken de voedingswaarden per portie voor $personen personen van dit recept: $ingLijst. Geef alleen JSON terug: {\"calorieen\": 0, \"koolhydraten\": 0, \"eiwitten\": 0, \"vetten\": 0}. Alle waarden als gehele getallen.";
        $macroPayload = json_encode([
            'contents' => [['parts' => [['text' => $vraag]]]],
            'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 100],
        ]);
        $ch2 = curl_init('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' . GOOGLE_API_KEY);
        curl_setopt_array($ch2, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $macroPayload, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]);
        $macroResp = curl_exec($ch2);
        curl_close($ch2);
        if ($macroResp) {
            $macroData = json_decode($macroResp, true);
            $macroParts = $macroData['candidates'][0]['content']['parts'] ?? [];
            $macroTekst = '';
            foreach ($macroParts as $part) {
                if (!empty($part['text']) && empty($part['thought'])) { $macroTekst = $part['text']; break; }
            }
            $ms = strpos($macroTekst, '{'); $me = strrpos($macroTekst, '}');
            if ($ms !== false && $me > $ms) {
                $macros = json_decode(substr($macroTekst, $ms, $me - $ms + 1), true);
                if ($macros) {
                    $cal = (int)($macros['calorieen'] ?? 0);
                    $kh  = (int)($macros['koolhydraten'] ?? 0);
                    $eiw = (int)($macros['eiwitten'] ?? 0);
                    $vet = (int)($macros['vetten'] ?? 0);
                }
            }
        }
    }

    json([
        'titel'           => $parsed['titel'],
        'personen'        => $personen,
        'afbeelding_url'  => null,
        'bron_url'        => $url,
        'tags'            => $parsed['tags'] ?? [],
        'ingredienten'    => $ingredienten,
        'bereiding'       => $parsed['bereiding'] ?? [],
        'voedingswaarden' => [
            'per_portie' => ['calorieen' => $cal, 'koolhydraten' => $kh, 'eiwitten' => $eiw, 'vetten' => $vet],
            'totaal'     => ['calorieen' => $cal * $personen, 'koolhydraten' => $kh * $personen, 'eiwitten' => $eiw * $personen, 'vetten' => $vet * $personen],
            'schatting'  => true,
        ],
    ]);
}

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
// Op dit punt is het de ruwe string uit JSON-LD ("1 lb beef", "2 tbsp olive oil").
// Onderaan loopt Gemini hierdoorheen om hoeveelheid + eenheid eruit te trekken
// en alles naar Nederlands te vertalen.
$ingredienten = [];
foreach ((array) ($schemaRecept['recipeIngredient'] ?? []) as $ing) {
    if (is_string($ing) && trim($ing)) {
        $ingredienten[] = ['naam' => trim(strip_tags($ing)), 'hoeveelheid' => null, 'eenheid' => '', 'voorraadkast' => false];
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

// --- Normaliseer + vertaal naar Nederlands via Gemini ---
// Lost twee problemen op tegelijk: (1) ingrediënten als ruwe string ("1 lb 90% lean ground beef"),
// (2) recepten in een vreemde taal. Gemini parseert hoeveelheid + eenheid, converteert imperial
// naar metric, vertaalt naar Nederlands.
if (defined('GOOGLE_API_KEY') && GOOGLE_API_KEY && !empty($ingredienten)) {
    $ingLijnen   = array_map(fn($i) => $i['naam'], $ingredienten);
    $bereidLijnen = $bereiding;

    $prompt = "Normaliseer en vertaal dit recept naar Nederlands. Geef ALLEEN een JSON-object terug, geen markdown:\n"
        . "{\"titel\":\"...\",\"ingredienten\":[{\"naam\":\"...\",\"hoeveelheid\":null,\"eenheid\":\"\"}],\"bereiding\":[\"...\"]}\n\n"
        . "Input:\n"
        . "Titel: " . $titel . "\n"
        . "Ingrediënten:\n- " . implode("\n- ", $ingLijnen) . "\n"
        . "Bereiding:\n- " . implode("\n- ", $bereidLijnen) . "\n\n"
        . "Regels:\n"
        . "- titel: korte Nederlandse receptnaam.\n"
        . "- ingredienten: parse hoeveelheid (getal) + eenheid + naam uit elke input-regel. Behoud volgorde.\n"
        . "  eenheid moet uit deze lijst komen of leeg zijn: [g, kg, ml, l, el, tl, kl, cup, stuk, teen, plak, sneetje, handvol, snufje].\n"
        . "  Imperial → metric: 1 lb ≈ 454 g, 1 oz ≈ 28 g, 1 tbsp = 1 el, 1 tsp = 1 tl, 1 fl oz ≈ 30 ml, 1 quart ≈ 950 ml, 1 pint ≈ 470 ml.\n"
        . "  Verwerk fracties (1/2, 1/4, etc.) als decimalen (0.5, 0.25).\n"
        . "  Vertaal ingrediënt-namen naar Nederlands; behoud merknamen onveranderd.\n"
        . "  Geen voorraadkast-veld toevoegen.\n"
        . "- bereiding: korte, duidelijke Nederlandse stappen in dezelfde volgorde als de input.\n";

    $payload = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 4096],
    ]);
    $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' . GOOGLE_API_KEY);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if ($resp) {
        $respData = json_decode($resp, true);
        $parts = $respData['candidates'][0]['content']['parts'] ?? [];
        $tekst = '';
        foreach ($parts as $part) {
            if (!empty($part['text']) && empty($part['thought'])) { $tekst = $part['text']; break; }
        }
        $s = strpos($tekst, '{'); $e = strrpos($tekst, '}');
        if ($s !== false && $e > $s) {
            $parsed = json_decode(substr($tekst, $s, $e - $s + 1), true);
            if ($parsed && is_array($parsed)) {
                if (!empty($parsed['titel'])) {
                    $titel = $parsed['titel'];
                }
                if (is_array($parsed['ingredienten'] ?? null) && count($parsed['ingredienten']) > 0) {
                    $genormaliseerd = [];
                    foreach ($parsed['ingredienten'] as $ing) {
                        $naam = trim((string)($ing['naam'] ?? ''));
                        if ($naam === '') continue;
                        $hoeveelheid = null;
                        if (isset($ing['hoeveelheid']) && is_numeric($ing['hoeveelheid'])) {
                            $hoeveelheid = (float)$ing['hoeveelheid'];
                        }
                        $genormaliseerd[] = [
                            'naam'         => $naam,
                            'hoeveelheid'  => $hoeveelheid,
                            'eenheid'      => trim((string)($ing['eenheid'] ?? '')),
                            'voorraadkast' => false,
                        ];
                    }
                    if (!empty($genormaliseerd)) $ingredienten = $genormaliseerd;
                }
                if (is_array($parsed['bereiding'] ?? null) && count($parsed['bereiding']) > 0) {
                    $bereiding = array_values(array_filter(
                        array_map(fn($s) => trim((string)$s), $parsed['bereiding']),
                        fn($s) => $s !== ''
                    ));
                }
            }
        }
    }
    // Bij elke fout houden we de ruwe scrape — import gaat door.
}

// --- Voedingswaarden ---
function parseMacro(mixed $waarde): float {
    if (!$waarde) return 0;
    $s = str_replace(',', '.', (string) $waarde);
    // Extraheer eerste getal inclusief decimalen
    if (preg_match('/(\d+(?:\.\d+)?)/', $s, $m)) return (float) $m[1];
    return 0;
}

$cal = $kh = $eiw = $vet = 0;
$heeftMacros = false;
if (isset($schemaRecept['nutrition']) && is_array($schemaRecept['nutrition'])) {
    $n = $schemaRecept['nutrition'];
    $cal = parseMacro($n['calories'] ?? 0);
    $kh  = parseMacro($n['carbohydrateContent'] ?? 0);
    $eiw = parseMacro($n['proteinContent'] ?? 0);
    $vet = parseMacro($n['fatContent'] ?? 0);
    $heeftMacros = $cal > 0 || $kh > 0 || $eiw > 0 || $vet > 0;
}

// Als de website geen macros heeft: vraag Gemini om ze te berekenen
if (!$heeftMacros && defined('GOOGLE_API_KEY') && GOOGLE_API_KEY) {
    $ingLijst = implode(', ', array_map(fn($i) => $i['naam'], $ingredienten));
    $vraag = "Bereken de voedingswaarden per portie voor $personen personen van dit recept: $ingLijst. Geef alleen JSON terug: {\"calorieen\": 0, \"koolhydraten\": 0, \"eiwitten\": 0, \"vetten\": 0}. Alle waarden als gehele getallen.";

    $payload = json_encode([
        'contents' => [['parts' => [['text' => $vraag]]]],
        'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 100],
    ]);
    $apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' . GOOGLE_API_KEY;
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if ($resp) {
        $respData = json_decode($resp, true);
        $parts = $respData['candidates'][0]['content']['parts'] ?? [];
        $tekst = '';
        foreach ($parts as $part) {
            if (!empty($part['text']) && empty($part['thought'])) { $tekst = $part['text']; break; }
        }
        $s = strpos($tekst, '{'); $e = strrpos($tekst, '}');
        if ($s !== false && $e > $s) {
            $macros = json_decode(substr($tekst, $s, $e - $s + 1), true);
            if ($macros) {
                $cal = parseMacro($macros['calorieen'] ?? 0);
                $kh  = parseMacro($macros['koolhydraten'] ?? 0);
                $eiw = parseMacro($macros['eiwitten'] ?? 0);
                $vet = parseMacro($macros['vetten'] ?? 0);
            }
        }
    }
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
        'per_portie' => ['calorieen' => (int) round($cal), 'koolhydraten' => (int) round($kh), 'eiwitten' => (int) round($eiw), 'vetten' => (int) round($vet)],
        'totaal'     => ['calorieen' => (int) round($cal * $personen), 'koolhydraten' => (int) round($kh * $personen), 'eiwitten' => (int) round($eiw * $personen), 'vetten' => (int) round($vet * $personen)],
        'schatting'  => !$heeftMacros,
    ],
]);
