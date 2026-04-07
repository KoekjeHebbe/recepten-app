<?php
/**
 * NEVO CSV importscript.
 * Gebruik: POST /api/nevo  (multipart/form-data, veld: bestand)
 * Of CLI:  php importeer-nevo.php /pad/naar/nevo.csv
 *
 * Verwacht pijp-gescheiden (|) NEVO-Online CSV, waarden tussen dubbele aanhalingstekens.
 * Alle macrowaarden zijn in NEVO per 100g → wij slaan op per 1g (canonical).
 */

// ─── Kolomindices in NEVO-Online CSV ────────────────────────────────────────
const NEVO_NAAM    = 4;   // Voedingsmiddelnaam/Dutch food name
const NEVO_KCAL    = 12;  // ENERCC (kcal)
const NEVO_PROT    = 14;  // PROT (g)
const NEVO_FAT     = 19;  // FAT (g)
const NEVO_CHO     = 27;  // CHO (g)
const NEVO_PER     = 100; // NEVO waarden zijn per 100g

// ─── CLI of web? ─────────────────────────────────────────────────────────────
$isCli = php_sapi_name() === 'cli';

if (!$isCli) {
    require_once __DIR__ . '/config.php';
    cors();
    vereisLogin();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Alleen POST', 405);
    if (empty($_FILES['bestand'])) error('Geen bestand ontvangen');
    $csvPad  = $_FILES['bestand']['tmp_name'];
    $overschrijf = ($_POST['overschrijf'] ?? 'nee') === 'ja';
} else {
    require_once __DIR__ . '/config.php';
    $csvPad      = $argv[1] ?? null;
    $overschrijf = in_array('--overschrijf', $argv);
    if (!$csvPad || !file_exists($csvPad)) {
        fwrite(STDERR, "Gebruik: php importeer-nevo.php bestand.csv [--overschrijf]\n");
        exit(1);
    }
}

// ─── Verwerk CSV ─────────────────────────────────────────────────────────────
function parseNevoGetal(string $s): float {
    // NEVO gebruikt komma als decimaalscheiding en soms lege waarden
    $s = trim($s, " \t\n\r\0\x0B\"");
    if ($s === '' || $s === '-') return 0.0;
    return (float) str_replace(',', '.', $s);
}

$fh = fopen($csvPad, 'r');
if (!$fh) {
    $isCli ? die("Kan bestand niet openen.\n") : error('Kan bestand niet openen', 500);
}

// Detecteer scheidingsteken (eerste lijn)
$eersteRegel = fgets($fh);
rewind($fh);
$sep = str_contains($eersteRegel, '|') ? '|' : ';';

$ingevoegd  = 0;
$overgeslagen = 0;
$fouten     = 0;
$rijnummer  = 0;

$insertStmt = db()->prepare(
    'INSERT INTO ingredient_macros_cache (naam_hash, naam, macros)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE ' .
    ($overschrijf
        ? 'macros = VALUES(macros), naam = VALUES(naam), bijgewerkt_op = NOW()'
        : 'naam_hash = naam_hash')  // no-op: sla bestaande over
);

while (($kolommen = fgetcsv($fh, 0, $sep, '"')) !== false) {
    $rijnummer++;

    // Sla headerrij(en) over (beginnen met "NEVO" of "Voedingsmiddel")
    $eerste = trim($kolommen[0] ?? '', '"');
    if ($rijnummer === 1 || str_starts_with($eerste, 'NEVO') || str_starts_with($eerste, 'Voedingsmiddel')) {
        continue;
    }

    $naam = trim($kolommen[NEVO_NAAM] ?? '', " \t\n\r\0\x0B\"");
    if ($naam === '') { $fouten++; continue; }

    $kcal = parseNevoGetal($kolommen[NEVO_KCAL] ?? '');
    $prot = parseNevoGetal($kolommen[NEVO_PROT] ?? '');
    $fat  = parseNevoGetal($kolommen[NEVO_FAT]  ?? '');
    $cho  = parseNevoGetal($kolommen[NEVO_CHO]  ?? '');

    // Opslaan per 100g (NEVO is al per 100g — geen deling nodig)
    $macros = [
        'calorieen'    => round($kcal, 2),
        'koolhydraten' => round($cho,  2),
        'eiwitten'     => round($prot, 2),
        'vetten'       => round($fat,  2),
    ];

    $hash = hash('sha256', strtolower($naam) . '|g');

    try {
        $insertStmt->execute([$hash, $naam, json_encode($macros)]);
        $affected = $insertStmt->rowCount();
        if ($affected > 0) $ingevoegd++;
        else $overgeslagen++;
    } catch (Throwable $e) {
        $fouten++;
        if ($isCli) fwrite(STDERR, "Rij $rijnummer: " . $e->getMessage() . "\n");
    }
}

fclose($fh);

$resultaat = [
    'ingevoegd'   => $ingevoegd,
    'overgeslagen' => $overgeslagen,
    'fouten'      => $fouten,
    'totaal_cache' => (int) db()->query('SELECT COUNT(*) FROM ingredient_macros_cache')->fetchColumn(),
];

if ($isCli) {
    echo "Ingevoegd:    {$resultaat['ingevoegd']}\n";
    echo "Overgeslagen: {$resultaat['overgeslagen']}\n";
    echo "Fouten:       {$resultaat['fouten']}\n";
    echo "Cache totaal: {$resultaat['totaal_cache']}\n";
} else {
    json($resultaat);
}
