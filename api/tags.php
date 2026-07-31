<?php
/**
 * Beheer van de tag-woordenlijst (maaltijdtypes + inhoudstags).
 *
 * GET    /api/tags            → { maaltijd: [...], tag: [...] }  (publiek)
 * POST   /api/tags            → { naam, soort }                  (login)
 * DELETE /api/tags/{id}       → verwijder optie                  (login)
 *
 * De tabel wordt bij de eerste aanroep aangemaakt en gevuld met de tot nu toe
 * hardgecodeerde lijst, aangevuld met alle tags die al in recepten voorkomen.
 */
require_once __DIR__ . '/config.php';
cors();

const STANDAARD_MAALTIJDEN = ['diner', 'lunch', 'bijgerecht', 'tapas', 'ontbijt', 'snack', 'dessert'];
const STANDAARD_TAGS = [
    'kip', 'kalkoen', 'rund', 'kalf', 'varken', 'lamsvlees', 'konijn', 'vis', 'garnalen',
    'vegetarisch', 'vegan', 'pasta', 'rijst', 'soep', 'salade', 'wrap', 'flatbread',
    'gemengd_gehakt', 'low_carb', 'snel',
];

/** Normaliseer een tagnaam: kleine letters, spaties → underscore. */
function normaliseerTagNaam(string $naam): string {
    $n = strtolower(trim($naam));
    $n = preg_replace('/\s+/', '_', $n);
    $n = preg_replace('/[^a-z0-9_\-]/u', '', $n);
    return trim($n, '_-');
}

function zorgVoorTabel(): void {
    db()->exec(
        "CREATE TABLE IF NOT EXISTS tag_opties (
            id INT AUTO_INCREMENT PRIMARY KEY,
            naam VARCHAR(64) NOT NULL,
            soort ENUM('maaltijd','tag') NOT NULL,
            volgorde INT NOT NULL DEFAULT 0,
            UNIQUE KEY uniek_naam_soort (naam, soort)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $aantal = (int) db()->query("SELECT COUNT(*) FROM tag_opties")->fetchColumn();
    if ($aantal > 0) return;

    // Eerste keer: vullen met de standaardlijst + alles wat al in recepten gebruikt wordt
    $gebruikt = [];
    foreach (db()->query("SELECT data FROM recepten")->fetchAll(PDO::FETCH_COLUMN) as $json) {
        $d = json_decode($json, true);
        foreach (($d['tags'] ?? []) as $t) {
            $t = normaliseerTagNaam((string)$t);
            if ($t !== '' && $t !== 'recept') $gebruikt[$t] = true;
        }
    }

    $ins = db()->prepare("INSERT IGNORE INTO tag_opties (naam, soort, volgorde) VALUES (?, ?, ?)");
    $i = 0;
    foreach (STANDAARD_MAALTIJDEN as $m) $ins->execute([$m, 'maaltijd', $i++]);
    $i = 0;
    foreach (STANDAARD_TAGS as $t) { $ins->execute([$t, 'tag', $i++]); unset($gebruikt[$t]); }
    foreach (array_keys($gebruikt) as $t) {
        if (in_array($t, STANDAARD_MAALTIJDEN, true)) continue;
        $ins->execute([$t, 'tag', $i++]);
    }
}

zorgVoorTabel();

$methode = $_SERVER['REQUEST_METHOD'];
$pad     = trim($_SERVER['PATH_INFO'] ?? '', '/');

// ─── GET: lijst (publiek, met gebruiksteller) ───────────────────────────────
if ($methode === 'GET') {
    $rijen = db()->query("SELECT id, naam, soort FROM tag_opties ORDER BY soort, volgorde, naam")->fetchAll(PDO::FETCH_ASSOC);

    // Tel hoe vaak elke tag in recepten voorkomt
    $tellingen = [];
    foreach (db()->query("SELECT data FROM recepten")->fetchAll(PDO::FETCH_COLUMN) as $json) {
        $d = json_decode($json, true);
        foreach (($d['tags'] ?? []) as $t) {
            $t = (string)$t;
            $tellingen[$t] = ($tellingen[$t] ?? 0) + 1;
        }
    }

    $uit = ['maaltijd' => [], 'tag' => []];
    foreach ($rijen as $r) {
        $uit[$r['soort']][] = [
            'id'      => (int)$r['id'],
            'naam'    => $r['naam'],
            'gebruikt'=> $tellingen[$r['naam']] ?? 0,
        ];
    }
    json($uit);
}

vereisLogin();

// ─── POST: nieuwe optie ─────────────────────────────────────────────────────
if ($methode === 'POST') {
    $data  = body();
    $naam  = normaliseerTagNaam((string)($data['naam'] ?? ''));
    $soort = ($data['soort'] ?? 'tag') === 'maaltijd' ? 'maaltijd' : 'tag';

    if ($naam === '') error('Geef een geldige naam op (letters, cijfers, streepjes).');
    if (mb_strlen($naam) > 64) error('Naam is te lang (max 64 tekens).');

    $bestaat = db()->prepare("SELECT id FROM tag_opties WHERE naam = ? AND soort = ?");
    $bestaat->execute([$naam, $soort]);
    if ($rij = $bestaat->fetch(PDO::FETCH_ASSOC)) {
        json(['id' => (int)$rij['id'], 'naam' => $naam, 'soort' => $soort, 'gebruikt' => 0, 'bestond' => true]);
    }

    $volg = (int) db()->query("SELECT COALESCE(MAX(volgorde), 0) + 1 FROM tag_opties")->fetchColumn();
    $ins = db()->prepare("INSERT INTO tag_opties (naam, soort, volgorde) VALUES (?, ?, ?)");
    $ins->execute([$naam, $soort, $volg]);
    json(['id' => (int)db()->lastInsertId(), 'naam' => $naam, 'soort' => $soort, 'gebruikt' => 0], 201);
}

// ─── DELETE: optie verwijderen (recepten behouden hun tag) ──────────────────
if ($methode === 'DELETE') {
    $id = (int) $pad;
    if (!$id) error('Ongeldig id');
    $del = db()->prepare("DELETE FROM tag_opties WHERE id = ?");
    $del->execute([$id]);
    if ($del->rowCount() === 0) error('Optie niet gevonden', 404);
    json(['ok' => true]);
}

error('Methode niet toegestaan', 405);
