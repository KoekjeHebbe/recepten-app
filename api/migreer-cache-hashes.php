<?php
// migreer-cache-hashes.php — eenmalig: zet alle cache-entries om naar
// het cacheSleutel-formaat (sha256("naam|canonical_eenheid")). Te draaien
// via CLI op de server.

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("CLI alleen.\n");
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/eenheden.php';

$rows = db()->query('SELECT naam_hash, naam, macros, bijgewerkt_op FROM ingredient_macros_cache')->fetchAll(PDO::FETCH_ASSOC);
echo "Totaal entries: " . count($rows) . "\n";

$ongewijzigd  = 0;
$bijgewerkt   = 0;
$samengevoegd = 0;

foreach ($rows as $row) {
    $p = parseSamengesteldeNaam($row['naam']);
    // Geen eenheid in naam: defaulteer naar 'g' (meest voorkomend voor voedsel)
    $eenheid = $p['eenheid'] !== '' ? $p['eenheid'] : 'g';
    $canonical = canonischeEenheid($eenheid);
    $nieuwNaam = $p['basis'] . ' (' . $canonical . ')';
    $nieuwHash = cacheSleutel($p['basis'], $canonical);

    if ($nieuwHash === $row['naam_hash'] && $nieuwNaam === $row['naam']) {
        $ongewijzigd++;
        continue;
    }

    // Conflict-check: bestaat de doelhash al voor een ANDERE rij?
    $check = db()->prepare(
        'SELECT naam_hash, naam, bijgewerkt_op FROM ingredient_macros_cache
         WHERE naam_hash = ? AND naam_hash != ?'
    );
    $check->execute([$nieuwHash, $row['naam_hash']]);
    $bestaand = $check->fetch(PDO::FETCH_ASSOC);

    if ($bestaand) {
        // Conflict: kies de oudst-bijgewerkte (meest waarschijnlijk handmatig
        // door gebruiker toegevoegd, niet door Gemini auto-gegenereerd).
        if ($row['bijgewerkt_op'] <= $bestaand['bijgewerkt_op']) {
            // Huidige rij is ouder of even oud → verwijder de bestaande, dan migreer
            db()->prepare('DELETE FROM ingredient_macros_cache WHERE naam_hash = ?')
                ->execute([$bestaand['naam_hash']]);
            echo "Samengevoegd: '{$bestaand['naam']}' verwijderd, '{$row['naam']}' krijgt voorkeur\n";
            $samengevoegd++;
        } else {
            // Bestaand is ouder → verwijder huidige rij
            db()->prepare('DELETE FROM ingredient_macros_cache WHERE naam_hash = ?')
                ->execute([$row['naam_hash']]);
            echo "Samengevoegd: '{$row['naam']}' verwijderd, '{$bestaand['naam']}' krijgt voorkeur\n";
            $samengevoegd++;
            continue;
        }
    }

    db()->prepare(
        'UPDATE ingredient_macros_cache SET naam_hash = ?, naam = ? WHERE naam_hash = ?'
    )->execute([$nieuwHash, $nieuwNaam, $row['naam_hash']]);
    $bijgewerkt++;
}

echo "\nResultaat:\n";
echo "  Ongewijzigd:  $ongewijzigd\n";
echo "  Bijgewerkt:   $bijgewerkt\n";
echo "  Samengevoegd: $samengevoegd\n";
