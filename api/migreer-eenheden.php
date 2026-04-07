<?php
/**
 * Migratiescript: zet hoeveelheid (string) om naar hoeveelheid (number) + eenheid (string).
 * Veilig om meerdere keren te draaien (ingrediënten die al 'eenheid' hebben worden overgeslagen).
 *
 * Gebruik: php migreer-eenheden.php
 */
if (php_sapi_name() !== 'cli') { http_response_code(403); exit('Alleen CLI.'); }

require_once __DIR__ . '/config.php';

// Volgorde: langste eerst zodat "sneetje" matched vóór "stuk"
$EENHEDEN = ['sneetje', 'handvol', 'snufje', 'stuk', 'teen', 'plak',
             'cup', 'kg', 'kl', 'el', 'tl', 'ml', 'l', 'g'];

function parseerHoeveelheid(string $str, array $eenheden): array {
    $s = trim($str);
    if ($s === '') return ['hoeveelheid' => null, 'eenheid' => ''];

    $patroon = '/^(\d+(?:[.,]\d+)?)\s*(' . implode('|', $eenheden) . ')?\b/i';
    if (preg_match($patroon, $s, $m)) {
        $getal   = (float) str_replace(',', '.', $m[1]);
        $eenheid = strtolower($m[2] ?? '');
        if ($eenheid === '') $eenheid = 'stuk'; // losse getallen → stuk
        return ['hoeveelheid' => $getal, 'eenheid' => $eenheid];
    }

    // Puur tekst ("naar smaak", "optioneel", …)
    return ['hoeveelheid' => null, 'eenheid' => ''];
}

$stmt     = db()->query('SELECT id, data FROM recepten');
$recepten = $stmt->fetchAll(PDO::FETCH_ASSOC);
$teller   = 0;

foreach ($recepten as $rij) {
    $data      = json_decode($rij['data'], true);
    $gewijzigd = false;

    foreach ($data['ingredienten'] as &$ing) {
        // Al in nieuw formaat?
        if (array_key_exists('eenheid', $ing) && !is_string($ing['hoeveelheid'])) continue;

        $oud = is_string($ing['hoeveelheid']) ? $ing['hoeveelheid'] : '';
        $parsed = parseerHoeveelheid($oud, $EENHEDEN);

        $ing['hoeveelheid'] = $parsed['hoeveelheid'];
        $ing['eenheid']     = $parsed['eenheid'];
        unset($ing['macros_referentie']); // Verwijder — wordt herberekend bij volgende opslag
        $gewijzigd = true;
    }
    unset($ing);

    if ($gewijzigd) {
        db()->prepare('UPDATE recepten SET data = ? WHERE id = ?')
            ->execute([json_encode($data, JSON_UNESCAPED_UNICODE), $rij['id']]);
        echo "✓ {$rij['id']}\n";
        $teller++;
    }
}

// Cache leegmaken: oud formaat (per hoeveelheids-string) is niet meer geldig
db()->exec('TRUNCATE TABLE ingredient_macros_cache');
echo "Cache geleegd.\n";
echo "Klaar: $teller recept(en) gemigreerd.\n";
