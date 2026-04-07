<?php
require_once __DIR__ . '/config.php';
cors();

// ─── Eenheden & conversie ────────────────────────────────────────────────────

$EENHEID_CANONICAL = [
    'g' => 'g',  'kg' => 'g',
    'ml' => 'ml', 'l' => 'ml', 'el' => 'ml', 'tl' => 'ml', 'kl' => 'ml', 'cup' => 'ml',
    'stuk' => 'stuk', 'teen' => 'teen', 'plak' => 'plak',
    'sneetje' => 'sneetje', 'handvol' => 'handvol', 'snufje' => 'snufje',
];

$NAAR_CANONICAL = [
    'g' => 1.0,  'kg' => 1000.0,
    'ml' => 1.0, 'l' => 1000.0, 'el' => 15.0, 'tl' => 5.0, 'kl' => 2.5, 'cup' => 240.0,
    'stuk' => 1.0, 'teen' => 1.0, 'plak' => 1.0,
    'sneetje' => 1.0, 'handvol' => 1.0, 'snufje' => 1.0,
];

function canonischeEenheid(string $eenheid): string {
    global $EENHEID_CANONICAL;
    return $EENHEID_CANONICAL[$eenheid] ?? $eenheid;
}

function naarCanonischeFactor(string $eenheid): float {
    global $NAAR_CANONICAL;
    return (float)($NAAR_CANONICAL[$eenheid] ?? 1.0);
}

// Voor g/ml: vraag Gemini om macros per 100 canonical units (betere precisie)
// Voor stuks: vraag per 1 unit
function referentieHoeveelheid(string $canonisch): float {
    return in_array($canonisch, ['g', 'ml'], true) ? 100.0 : 1.0;
}

// Cache-sleutel: SHA-256 van "genormaliseerde naam|canonieke eenheid"
function cacheSleutel(string $naam, string $eenheid): string {
    $canonisch = canonischeEenheid($eenheid);
    return hash('sha256', strtolower(trim($naam)) . '|' . $canonisch);
}

// ─── Cache-laag ──────────────────────────────────────────────────────────────

/**
 * Haal macros op voor alle ingrediënten met cache-laag.
 * Cache-sleutel = naam + canonieke eenheid; waarden = macros per 1 canonieke eenheid.
 * Alleen niet-gecachete ingrediënten gaan naar Gemini.
 */
function haalMacrosMetCache(array $ingredienten): array {
    $count = count($ingredienten);
    if ($count === 0) return [];

    $hashes = [];
    foreach ($ingredienten as $ing) {
        $hashes[] = cacheSleutel($ing['naam'] ?? '', $ing['eenheid'] ?? '');
    }

    // DB-lookup
    $placeholders = implode(',', array_fill(0, $count, '?'));
    $stmt = db()->prepare("SELECT naam_hash, macros FROM ingredient_macros_cache WHERE naam_hash IN ($placeholders)");
    $stmt->execute($hashes);
    $gecached = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $rij) {
        $gecached[$rij['naam_hash']] = json_decode($rij['macros'], true);
    }

    // Welke missen nog?
    $nieuweIndexen = [];
    for ($i = 0; $i < $count; $i++) {
        if (!isset($gecached[$hashes[$i]])) $nieuweIndexen[] = $i;
    }

    // Gemini voor de ontbrekende
    $nieuweMacros = [];
    if (!empty($nieuweIndexen)) {
        $nieuweIngrs     = array_map(fn($i) => $ingredienten[$i], $nieuweIndexen);
        $geminiResultaat = haalMacrosViaGemini($nieuweIngrs);

        $insertStmt = db()->prepare(
            'INSERT INTO ingredient_macros_cache (naam_hash, naam, macros)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE macros = VALUES(macros), naam = VALUES(naam), bijgewerkt_op = NOW()'
        );
        foreach ($nieuweIndexen as $pos => $origIdx) {
            $macros = $geminiResultaat[$pos] ?? null;
            $nieuweMacros[$origIdx] = $macros;
            if ($macros) {
                $label = ($ingredienten[$origIdx]['naam'] ?? '') . ' (' . canonischeEenheid($ingredienten[$origIdx]['eenheid'] ?? '') . ')';
                $insertStmt->execute([$hashes[$origIdx], $label, json_encode($macros)]);
            }
        }
    }

    $resultaat = [];
    for ($i = 0; $i < $count; $i++) {
        $resultaat[] = $gecached[$hashes[$i]] ?? ($nieuweMacros[$i] ?? null);
    }
    return $resultaat;
}

// ─── Gemini API ──────────────────────────────────────────────────────────────

/**
 * Vraag Gemini om macros per 1 canonieke eenheid voor elk ingrediënt.
 * Intern vraagt Gemini per 100g/100ml (of per 1 stuk) en deelt het resultaat.
 */
function haalMacrosViaGemini(array $ingredienten): array {
    $count = count($ingredienten);
    $leeg  = array_fill(0, $count, null);

    if ($count === 0 || !defined('GOOGLE_API_KEY') || !GOOGLE_API_KEY) return $leeg;

    // Bouw de lijst op met referentiehoeveelheden
    $lijstRegels  = [];
    $refHoevs     = [];
    foreach ($ingredienten as $i => $ing) {
        $eenheid   = $ing['eenheid'] ?? '';
        $canonisch = canonischeEenheid($eenheid);
        $ref       = referentieHoeveelheid($canonisch);
        $refStr    = ($ref == 1.0) ? "1 $eenheid" : "$ref $canonisch";
        $lijstRegels[] = ($i + 1) . '. ' . $refStr . ' ' . ($ing['naam'] ?? '');
        $refHoevs[]    = $ref;
    }

    $prompt = "Bereken de macronutriënten voor elk ingrediënt in de opgegeven hoeveelheid.\n"
            . "Geef ALLEEN een JSON-array (geen uitleg, geen markdown), één object per ingrediënt in dezelfde volgorde:\n"
            . "[{\"calorieen\":0,\"koolhydraten\":0,\"eiwitten\":0,\"vetten\":0}, ...]\n"
            . "Alle waarden als decimale getallen (max 4 decimalen).\n\n"
            . "Ingrediënten:\n" . implode("\n", $lijstRegels);

    $payload = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 512],
    ]);

    $apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . GOOGLE_API_KEY;
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if (!$resp) return $leeg;

    $respData = json_decode($resp, true);
    $parts    = $respData['candidates'][0]['content']['parts'] ?? [];
    $tekst    = '';
    foreach ($parts as $part) {
        if (!empty($part['text']) && empty($part['thought'])) { $tekst = $part['text']; break; }
    }

    $s = strpos($tekst, '[');
    $e = strrpos($tekst, ']');
    if ($s === false || $e <= $s) return $leeg;

    $parsed = json_decode(substr($tekst, $s, $e - $s + 1), true);
    if (!is_array($parsed)) return $leeg;

    // Deel door referentiehoeveelheid → macros per 1 canonieke eenheid
    $resultaat = [];
    for ($i = 0; $i < $count; $i++) {
        $m   = $parsed[$i] ?? null;
        $ref = $refHoevs[$i] ?? 1.0;
        if (!is_array($m) || $ref <= 0) { $resultaat[] = null; continue; }
        $resultaat[] = [
            'calorieen'    => round(((float)($m['calorieen']    ?? 0)) / $ref, 4),
            'koolhydraten' => round(((float)($m['koolhydraten'] ?? 0)) / $ref, 4),
            'eiwitten'     => round(((float)($m['eiwitten']     ?? 0)) / $ref, 4),
            'vetten'       => round(((float)($m['vetten']       ?? 0)) / $ref, 4),
        ];
    }
    return $resultaat;
}

// ─── Voedingswaarden herberekenen ────────────────────────────────────────────

/**
 * Herbereken voedingswaarden op basis van macros_referentie per ingrediënt.
 * Formule: hoeveelheid × canonical_factor × macros_per_canonical_unit
 */
function herbereken_voedingswaarden(array &$data): void {
    $ingredienten = $data['ingredienten'] ?? [];
    $personen     = max(1, (int)($data['personen'] ?? 1));

    $totaal      = ['calorieen' => 0.0, 'koolhydraten' => 0.0, 'eiwitten' => 0.0, 'vetten' => 0.0];
    $heeftMacros = false;

    foreach ($ingredienten as $ing) {
        $macros      = $ing['macros_referentie'] ?? null;
        $hoeveelheid = isset($ing['hoeveelheid']) ? (float)$ing['hoeveelheid'] : null;
        if (!$macros || $hoeveelheid === null || $hoeveelheid <= 0) continue;

        $canonischFactor = naarCanonischeFactor($ing['eenheid'] ?? '');
        $canonical       = $hoeveelheid * $canonischFactor;
        $heeftMacros     = true;

        foreach (['calorieen', 'koolhydraten', 'eiwitten', 'vetten'] as $key) {
            $totaal[$key] += (float)($macros[$key] ?? 0) * $canonical;
        }
    }

    if (!$heeftMacros) return;

    $data['voedingswaarden'] = [
        'totaal'     => array_map(fn($v) => (int) round($v), $totaal),
        'per_portie' => array_map(fn($v) => (int) round($v / $personen), $totaal),
        'schatting'  => false,
    ];
}

$methode = $_SERVER['REQUEST_METHOD'];
$pad = trim($_SERVER['PATH_INFO'] ?? '', '/');
$delen = explode('/', $pad);
$receptId = $delen[0] ?? null;

// GET /api/recepten — alle recepten
if ($methode === 'GET' && !$receptId) {
    $stmt = db()->query('SELECT id, data, aangemaakt_door, aangemaakt_op, bijgewerkt_op FROM recepten ORDER BY bijgewerkt_op DESC');
    $rijen = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $resultaat = array_map(function($rij) {
        $data = json_decode($rij['data'], true);
        $data['aangemaakt_door'] = $rij['aangemaakt_door'];
        $data['aangemaakt_op'] = $rij['aangemaakt_op'];
        $data['bijgewerkt_op'] = $rij['bijgewerkt_op'];
        return $data;
    }, $rijen);
    json($resultaat);
}

// GET /api/recepten/{id}
if ($methode === 'GET' && $receptId) {
    $stmt = db()->prepare('SELECT data, aangemaakt_door, aangemaakt_op, bijgewerkt_op FROM recepten WHERE id = ?');
    $stmt->execute([$receptId]);
    $rij = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$rij) error('Recept niet gevonden', 404);
    $data = json_decode($rij['data'], true);
    $data['aangemaakt_door'] = $rij['aangemaakt_door'];
    $data['aangemaakt_op'] = $rij['aangemaakt_op'];
    $data['bijgewerkt_op'] = $rij['bijgewerkt_op'];
    json($data);
}

// POST /api/recepten — nieuw recept (login vereist)
if ($methode === 'POST' && !$receptId) {
    $gebruiker = vereisLogin();
    $data = body();

    if (empty($data['id']) || empty($data['titel'])) error('id en titel zijn verplicht');

    $id = preg_replace('/[^a-z0-9\-]/', '', strtolower($data['id']));
    if (!$id) error('Ongeldig id');

    // Check of id al bestaat
    $stmt = db()->prepare('SELECT id FROM recepten WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->fetch()) {
        // Genereer uniek id
        $id = $id . '-' . time();
        $data['id'] = $id;
    }

    // Haal macros op via cache → Gemini voor alle ingrediënten
    $macrosLijst = haalMacrosMetCache($data['ingredienten']);
    foreach ($data['ingredienten'] as $i => &$ing) {
        $ing['macros_referentie'] = $macrosLijst[$i] ?? null;
    }
    unset($ing);

    // Herbereken totale voedingswaarden op basis van ingrediënt-macros
    herbereken_voedingswaarden($data);

    $stmt = db()->prepare('INSERT INTO recepten (id, data, aangemaakt_door) VALUES (?, ?, ?)');
    $stmt->execute([$id, json_encode($data, JSON_UNESCAPED_UNICODE), $gebruiker['sub']]);
    json($data, 201);
}

// PUT /api/recepten/{id} — recept bewerken (login vereist)
if ($methode === 'PUT' && $receptId) {
    $gebruiker = vereisLogin();
    $data = body();

    $stmt = db()->prepare('SELECT aangemaakt_door FROM recepten WHERE id = ?');
    $stmt->execute([$receptId]);
    $rij = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$rij) error('Recept niet gevonden', 404);
    if ((int)$rij['aangemaakt_door'] !== (int)$gebruiker['sub']) error('Geen toegang', 403);

    // Zorg dat id niet verandert
    $data['id'] = $receptId;

    // Herbereken macros via cache → Gemini voor alle ingrediënten
    // (cache maakt dit goedkoop: gecachete ingrediënten kosten alleen een DB-lookup)
    $macrosLijst = haalMacrosMetCache($data['ingredienten']);
    foreach ($data['ingredienten'] as $i => &$ing) {
        $ing['macros_referentie'] = $macrosLijst[$i] ?? null;
    }
    unset($ing);

    herbereken_voedingswaarden($data);

    $stmt = db()->prepare('UPDATE recepten SET data = ? WHERE id = ?');
    $stmt->execute([json_encode($data, JSON_UNESCAPED_UNICODE), $receptId]);
    json($data);
}

// DELETE /api/recepten/{id} (login vereist)
if ($methode === 'DELETE' && $receptId) {
    $gebruiker = vereisLogin();

    $stmt = db()->prepare('SELECT aangemaakt_door FROM recepten WHERE id = ?');
    $stmt->execute([$receptId]);
    $rij = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$rij) error('Recept niet gevonden', 404);
    if ((int)$rij['aangemaakt_door'] !== (int)$gebruiker['sub']) error('Geen toegang', 403);

    db()->prepare('DELETE FROM favorieten WHERE recept_id = ?')->execute([$receptId]);
    db()->prepare('DELETE FROM recepten WHERE id = ?')->execute([$receptId]);
    json(['ok' => true]);
}

error('Methode niet toegestaan', 405);
