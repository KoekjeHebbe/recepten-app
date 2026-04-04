<?php
// Eenmalig migratiescript — verwijder dit bestand na gebruik!
require_once __DIR__ . '/config.php';

$recepten = json_decode(file_get_contents(__DIR__ . '/recepten.json'), true);
if (!$recepten) {
    die("recepten.json niet gevonden of ongeldig\n");
}

$stmt = db()->prepare('INSERT IGNORE INTO recepten (id, data, aangemaakt_door) VALUES (?, ?, NULL)');
$ok = 0;
foreach ($recepten as $recept) {
    $stmt->execute([$recept['id'], json_encode($recept, JSON_UNESCAPED_UNICODE)]);
    $ok++;
    echo "✓ " . $recept['titel'] . "\n";
}
echo "\nKlaar: $ok recepten gemigreerd.\n";
