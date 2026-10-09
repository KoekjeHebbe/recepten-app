<?php
// Gedeelde macro-rekenlogica: gebruikt door recepten.php (opslaan) en
// colruyt.php (herberekenen na het koppelen van een Colruyt-product).
require_once __DIR__ . '/eenheden.php';

$NAAR_CANONICAL = [
    'g' => 1.0,  'kg' => 1000.0,
    'ml' => 1.0, 'l' => 1000.0, 'el' => 15.0, 'tl' => 5.0, 'kl' => 2.5, 'cup' => 240.0,
    'stuk' => 1.0, 'teen' => 1.0, 'plak' => 1.0,
    'sneetje' => 1.0, 'handvol' => 1.0, 'snufje' => 1.0,
];

function naarCanonischeFactor(string $eenheid): float {
    global $NAAR_CANONICAL;
    return (float)($NAAR_CANONICAL[$eenheid] ?? 1.0);
}

// Voor g/ml: vraag Gemini om macros per 100 canonical units (betere precisie)
// Voor stuks: vraag per 1 unit
function referentieHoeveelheid(string $canonisch): float {
    return in_array($canonisch, ['g', 'ml'], true) ? 100.0 : 1.0;
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
