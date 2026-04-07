<?php
require_once __DIR__ . '/config.php';
cors();
vereisLogin();

$methode = $_SERVER['REQUEST_METHOD'];
$hash    = trim($_SERVER['PATH_INFO'] ?? '', '/') ?: null;

// GET /api/cache — lijst alle entries, optioneel gefilterd op ?zoek= en ?limit=
if ($methode === 'GET' && !$hash) {
    $zoek  = trim($_GET['zoek'] ?? '');
    $limit = max(1, min(10000, (int)($_GET['limit'] ?? 50)));

    if ($zoek) {
        $stmt = db()->prepare(
            'SELECT naam_hash, naam, macros, bijgewerkt_op
             FROM ingredient_macros_cache
             WHERE naam LIKE ?
             ORDER BY naam LIMIT ' . $limit
        );
        $stmt->execute(['%' . $zoek . '%']);
    } else {
        $stmt = db()->prepare(
            'SELECT naam_hash, naam, macros, bijgewerkt_op
             FROM ingredient_macros_cache
             ORDER BY naam LIMIT ' . $limit
        );
        $stmt->execute();
    }
    $totaal = (int) db()->query('SELECT COUNT(*) FROM ingredient_macros_cache')->fetchColumn();
    $rijen  = $stmt->fetchAll(PDO::FETCH_ASSOC);
    json([
        'totaal'  => $totaal,
        'entries' => array_map(function ($rij) {
            $rij['macros'] = json_decode($rij['macros'], true);
            return $rij;
        }, $rijen),
    ]);
}

// GET /api/cache/stats — totaal aantal entries
if ($methode === 'GET' && $hash === 'stats') {
    $totaal = db()->query('SELECT COUNT(*) FROM ingredient_macros_cache')->fetchColumn();
    json(['totaal' => (int) $totaal]);
}

// POST /api/cache — handmatig een entry toevoegen of overschrijven
if ($methode === 'POST' && !$hash) {
    $data   = body();
    $naam   = trim($data['naam']   ?? '');
    $macros = $data['macros']      ?? null;
    if (!$naam || !$macros) error('naam en macros zijn verplicht');

    $naamHash = hash('sha256', strtolower($naam));
    db()->prepare(
        'INSERT INTO ingredient_macros_cache (naam_hash, naam, macros)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE macros = VALUES(macros), naam = VALUES(naam), bijgewerkt_op = NOW()'
    )->execute([$naamHash, $naam, json_encode($macros)]);

    json(['naam_hash' => $naamHash, 'naam' => $naam, 'macros' => $macros]);
}

// PUT /api/cache/{hash} — macros van een bestaande entry bijwerken
if ($methode === 'PUT' && $hash) {
    $data   = body();
    $macros = $data['macros'] ?? null;
    if (!$macros) error('macros zijn verplicht');

    $stmt = db()->prepare(
        'UPDATE ingredient_macros_cache SET macros = ?, bijgewerkt_op = NOW() WHERE naam_hash = ?'
    );
    $stmt->execute([json_encode($macros), $hash]);
    if ($stmt->rowCount() === 0) error('Niet gevonden', 404);
    json(['ok' => true]);
}

// DELETE /api/cache/{hash}
if ($methode === 'DELETE' && $hash) {
    db()->prepare('DELETE FROM ingredient_macros_cache WHERE naam_hash = ?')->execute([$hash]);
    json(['ok' => true]);
}

error('Methode niet toegestaan', 405);
