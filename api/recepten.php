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

/**
 * Normaliseer een ingrediënt naar {naam, hoeveelheid (float|null), eenheid}.
 * Vangt oude string-hoeveelheden op ("3 el", "200g") die door een oude frontend
 * verstuurd werden voordat het getal+eenheid formaat was uitgerold.
 */
function normaliseerIngredient(array $ing): array {
    // Al in nieuw formaat: hoeveelheid is numeriek (of null) en eenheid bestaat
    if (array_key_exists('eenheid', $ing) && (!isset($ing['hoeveelheid']) || is_numeric($ing['hoeveelheid']))) {
        return $ing;
    }

    // Oud formaat: hoeveelheid is een string zoals "3 el" of "200g"
    $str = trim((string)($ing['hoeveelheid'] ?? ''));
    $eenheden = ['sneetje','handvol','snufje','stuk','teen','plak','cup','kg','kl','el','tl','ml','l','g'];
    $patroon  = '/^(\d+(?:[.,]\d+)?)\s*(' . implode('|', $eenheden) . ')?\b/i';

    if ($str !== '' && preg_match($patroon, $str, $m)) {
        $ing['hoeveelheid'] = (float) str_replace(',', '.', $m[1]);
        $ing['eenheid']     = strtolower($m[2] ?? 'stuk');
    } else {
        $ing['hoeveelheid'] = null;
        $ing['eenheid']     = $ing['eenheid'] ?? '';
    }
    return $ing;
}

// ─── Fuzzy cache-match ───────────────────────────────────────────────────────

/**
 * Zoek de beste cache-match voor een ingredient via sliding-window LIKE-queries.
 * Werkt ook voor samengestelde Nederlandse woorden zoals "knolselderij" → "Selderij knol rauw".
 * Geeft null terug als geen goede match gevonden wordt (drempel: 40% similar_text).
 */
function zoekFuzzyMatch(string $naam, string $canonisch): ?array {
    $lower  = strtolower(trim($naam));
    if (strlen($lower) < 3) return null;

    // Tokens: woorden op spaties + sliding windows van 6 tekens voor samengestelde woorden
    $tokens = array_filter(preg_split('/\s+/', $lower), fn($w) => strlen($w) >= 3);
    if (count($tokens) <= 1 && strlen($lower) >= 6) {
        for ($i = 0; $i + 6 <= strlen($lower); $i++) {
            $tokens[] = substr($lower, $i, 6);
        }
    }
    $tokens = array_values(array_unique($tokens));
    if (empty($tokens)) return null;

    $conditions = implode(' OR ', array_fill(0, count($tokens), 'LOWER(naam) LIKE ?'));
    $params     = array_map(fn($t) => '%' . $t . '%', $tokens);

    // Filter op dezelfde canonieke eenheid zodat (g)-entries niet matchen voor (stuk)-lookups
    $params[] = '%(' . $canonisch . ')%';
    $stmt = db()->prepare(
        "SELECT naam_hash, naam, macros FROM ingredient_macros_cache
         WHERE ($conditions) AND LOWER(naam) LIKE ? LIMIT 40"
    );
    $stmt->execute($params);
    $kandidaten = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (empty($kandidaten)) return null;

    $beste = null;
    $besteScore = 0.0;
    foreach ($kandidaten as $k) {
        similar_text($lower, strtolower($k['naam']), $score);
        if ($score > $besteScore) {
            $besteScore = $score;
            $beste = $k;
        }
    }

    if ($besteScore >= 40.0 && $beste) {
        return json_decode($beste['macros'], true);
    }
    return null;
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

    // Normaliseer eerst naar nieuw formaat (vang oude string-hoeveelheden op)
    $ingredienten = array_map('normaliseerIngredient', $ingredienten);

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

    // Welke missen nog? Probeer eerst fuzzy match vóór Gemini.
    $insertStmt = db()->prepare(
        'INSERT INTO ingredient_macros_cache (naam_hash, naam, macros)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE macros = VALUES(macros), naam = VALUES(naam), bijgewerkt_op = NOW()'
    );

    $nieuweIndexen = [];
    for ($i = 0; $i < $count; $i++) {
        if (isset($gecached[$hashes[$i]])) continue;

        $ing       = $ingredienten[$i];
        $canonisch = canonischeEenheid($ing['eenheid'] ?? '');
        $fuzzy     = zoekFuzzyMatch($ing['naam'] ?? '', $canonisch);
        if ($fuzzy) {
            $gecached[$hashes[$i]] = $fuzzy;
            $label = ($ing['naam'] ?? '') . ' (' . $canonisch . ')';
            $insertStmt->execute([$hashes[$i], $label, json_encode($fuzzy)]);
        } else {
            $nieuweIndexen[] = $i;
        }
    }

    // Gemini enkel voor wat niet via fuzzy gevonden werd
    $nieuweMacros = [];
    if (!empty($nieuweIndexen)) {
        $nieuweIngrs     = array_map(fn($i) => $ingredienten[$i], $nieuweIndexen);
        $geminiResultaat = haalMacrosViaGemini($nieuweIngrs);

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
    $lijstRegels = [];
    foreach ($ingredienten as $i => $ing) {
        $eenheid   = $ing['eenheid'] ?? '';
        $canonisch = canonischeEenheid($eenheid);
        $ref       = referentieHoeveelheid($canonisch);
        $refStr    = $ref == 1.0 ? "1 $eenheid" : "$ref $canonisch";
        $lijstRegels[] = ($i + 1) . '. ' . $refStr . ' ' . ($ing['naam'] ?? '');
    }

    $prompt = "Bereken de macronutriënten voor elk ingrediënt in de opgegeven hoeveelheid.\n"
            . "Geef ALLEEN een JSON-array (geen uitleg, geen markdown), één object per ingrediënt in dezelfde volgorde:\n"
            . "[{\"calorieen\":0,\"koolhydraten\":0,\"eiwitten\":0,\"vetten\":0}, ...]\n"
            . "Alle waarden als decimale getallen (max 4 decimalen).\n\n"
            . "Ingrediënten:\n" . implode("\n", $lijstRegels);

    $payload = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 4096],
    ]);

    $apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' . GOOGLE_API_KEY;
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

    // Sla op per referentiehoeveelheid (100g/ml of 1 stuk) — NIET delen
    // zodat waarden leesbaar zijn (bijv. 884 kcal per 100ml, niet 8.84 per 1ml)
    $resultaat = [];
    for ($i = 0; $i < $count; $i++) {
        $m = $parsed[$i] ?? null;
        if (!is_array($m)) { $resultaat[] = null; continue; }
        $resultaat[] = [
            'calorieen'    => round((float)($m['calorieen']    ?? 0), 2),
            'koolhydraten' => round((float)($m['koolhydraten'] ?? 0), 2),
            'eiwitten'     => round((float)($m['eiwitten']     ?? 0), 2),
            'vetten'       => round((float)($m['vetten']       ?? 0), 2),
        ];
    }
    return $resultaat;
}

// ─── Onderdelen normaliseren ─────────────────────────────────────────────────

/**
 * Filter en valideer onderdelen-array. Drop entries die:
 * - lege recept_id of niet-positieve porties hebben
 * - naar zichzelf verwijzen
 * - naar een niet-bestaand recept verwijzen
 * - naar een recept verwijzen dat zelf onderdelen heeft (single-level guard)
 */
function normaliseerOnderdelen(array $onderdelen, ?string $eigenId): array {
    $resultaat = [];
    foreach ($onderdelen as $od) {
        if (!is_array($od)) continue;
        $rid = isset($od['recept_id']) ? trim((string)$od['recept_id']) : '';
        $porties = isset($od['porties']) ? (float)$od['porties'] : 0;
        if ($rid === '' || $porties <= 0) continue;
        if ($eigenId !== null && $rid === $eigenId) continue;

        $stmt = db()->prepare('SELECT data FROM recepten WHERE id = ?');
        $stmt->execute([$rid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) continue;
        $subData = json_decode($row['data'], true);
        if (!empty($subData['onderdelen'])) continue;

        $resultaat[] = ['recept_id' => $rid, 'porties' => $porties];
    }
    return $resultaat;
}

// ─── Voedingswaarden herberekenen ────────────────────────────────────────────

/**
 * Herbereken voedingswaarden op basis van macros_referentie per ingrediënt en
 * de per_portie van eventuele sub-recepten (onderdelen).
 * Formule: hoeveelheid × canonical_factor × macros_per_canonical_unit
 *        + sub.per_portie × porties
 */
function herbereken_voedingswaarden(array &$data): void {
    $ingredienten = $data['ingredienten'] ?? [];
    $onderdelen   = $data['onderdelen']   ?? [];
    $personen     = max(1, (int)($data['personen'] ?? 1));

    $totaal      = ['calorieen' => 0.0, 'koolhydraten' => 0.0, 'eiwitten' => 0.0, 'vetten' => 0.0];
    $heeftBron   = false;
    $isSchatting = false;

    foreach ($ingredienten as $rawIng) {
        $ing         = normaliseerIngredient($rawIng);
        $macros      = $ing['macros_referentie'] ?? null;
        $hoeveelheid = isset($ing['hoeveelheid']) ? (float)$ing['hoeveelheid'] : null;
        if (!$macros || $hoeveelheid === null || $hoeveelheid <= 0) continue;

        $canonischFactor = naarCanonischeFactor($ing['eenheid'] ?? '');
        $canonical       = $hoeveelheid * $canonischFactor;
        $ref             = referentieHoeveelheid(canonischeEenheid($ing['eenheid'] ?? ''));
        $heeftBron       = true;

        foreach (['calorieen', 'koolhydraten', 'eiwitten', 'vetten'] as $key) {
            $totaal[$key] += (float)($macros[$key] ?? 0) * $canonical / $ref;
        }
    }

    foreach ($onderdelen as $od) {
        $rid = $od['recept_id'] ?? '';
        $porties = (float)($od['porties'] ?? 0);
        if ($rid === '' || $porties <= 0) continue;

        $stmt = db()->prepare('SELECT data FROM recepten WHERE id = ?');
        $stmt->execute([$rid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) continue;
        $sub = json_decode($row['data'], true);
        $pp = $sub['voedingswaarden']['per_portie'] ?? null;
        if (!$pp) continue;

        $heeftBron = true;
        if (!empty($sub['voedingswaarden']['schatting'])) $isSchatting = true;

        foreach (['calorieen', 'koolhydraten', 'eiwitten', 'vetten'] as $key) {
            $totaal[$key] += (float)($pp[$key] ?? 0) * $porties;
        }
    }

    if (!$heeftBron) return;

    $data['voedingswaarden'] = [
        'totaal'     => array_map(fn($v) => (int) round($v), $totaal),
        'per_portie' => array_map(fn($v) => (int) round($v / $personen), $totaal),
        'schatting'  => $isSchatting,
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

    // Valideer onderdelen (single-level, bestaande recepten, geen self-ref)
    $data['onderdelen'] = normaliseerOnderdelen($data['onderdelen'] ?? [], $id);

    // Herbereken totale voedingswaarden op basis van ingrediënt-macros + sub-recepten
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
    $isSuperAdmin = defined('SUPERADMIN_IDS') && in_array((int)$gebruiker['sub'], SUPERADMIN_IDS, true);
    if ((int)$rij['aangemaakt_door'] !== (int)$gebruiker['sub'] && !$isSuperAdmin) error('Geen toegang', 403);

    // Zorg dat id niet verandert
    $data['id'] = $receptId;

    // Herbereken macros via cache → Gemini voor alle ingrediënten
    // (cache maakt dit goedkoop: gecachete ingrediënten kosten alleen een DB-lookup)
    $macrosLijst = haalMacrosMetCache($data['ingredienten']);
    foreach ($data['ingredienten'] as $i => &$ing) {
        $ing['macros_referentie'] = $macrosLijst[$i] ?? null;
    }
    unset($ing);

    // Valideer onderdelen (single-level, bestaande recepten, geen self-ref)
    $data['onderdelen'] = normaliseerOnderdelen($data['onderdelen'] ?? [], $receptId);

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
    $isSuperAdmin = defined('SUPERADMIN_IDS') && in_array((int)$gebruiker['sub'], SUPERADMIN_IDS, true);
    if ((int)$rij['aangemaakt_door'] !== (int)$gebruiker['sub'] && !$isSuperAdmin) error('Geen toegang', 403);

    db()->prepare('DELETE FROM favorieten WHERE recept_id = ?')->execute([$receptId]);
    db()->prepare('DELETE FROM recepten WHERE id = ?')->execute([$receptId]);
    json(['ok' => true]);
}

error('Methode niet toegestaan', 405);
