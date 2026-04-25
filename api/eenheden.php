<?php
// Gedeelde eenheid-mapping en cache-sleutel logica.
// Zorgt dat zowel de Extras-CRUD (cache.php) als het recept-save-pad
// (recepten.php) dezelfde naam_hash gebruiken voor hetzelfde ingrediënt.

$EENHEID_CANONICAL = [
    'g' => 'g',  'kg' => 'g',
    'ml' => 'ml', 'l' => 'ml', 'el' => 'ml', 'tl' => 'ml', 'kl' => 'ml', 'cup' => 'ml',
    'stuk' => 'stuk', 'teen' => 'teen', 'plak' => 'plak',
    'sneetje' => 'sneetje', 'handvol' => 'handvol', 'snufje' => 'snufje',
];

function canonischeEenheid(string $eenheid): string {
    global $EENHEID_CANONICAL;
    return $EENHEID_CANONICAL[strtolower($eenheid)] ?? strtolower($eenheid);
}

function cacheSleutel(string $naam, string $eenheid): string {
    return hash('sha256', strtolower(trim($naam)) . '|' . canonischeEenheid($eenheid));
}

/**
 * Parse "Kaas 48+ (g)" → ['basis' => 'Kaas 48+', 'eenheid' => 'g'].
 * Geen parens → ['basis' => $naam, 'eenheid' => ''].
 */
function parseSamengesteldeNaam(string $naam): array {
    if (preg_match('/^(.*?)\s*\(([a-zA-Z]+)\)\s*$/', trim($naam), $m)) {
        return ['basis' => trim($m[1]), 'eenheid' => strtolower($m[2])];
    }
    return ['basis' => trim($naam), 'eenheid' => ''];
}

/**
 * Cache-sleutel voor een composed name "Kaas 48+ (g)": parse en hash via cacheSleutel.
 */
function cacheSleutelUitNaam(string $naam): string {
    $p = parseSamengesteldeNaam($naam);
    return cacheSleutel($p['basis'], $p['eenheid']);
}
