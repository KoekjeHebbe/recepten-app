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

// PUT /api/cache/{hash} — macros en/of naam van een bestaande entry bijwerken
if ($methode === 'PUT' && $hash) {
    $data       = body();
    $macros     = $data['macros'] ?? null;
    $nieuweNaam = isset($data['naam']) ? trim((string)$data['naam']) : null;
    if (!$macros && !$nieuweNaam) error('macros of naam zijn verplicht');

    $huidig = db()->prepare('SELECT naam, macros FROM ingredient_macros_cache WHERE naam_hash = ?');
    $huidig->execute([$hash]);
    $rij = $huidig->fetch(PDO::FETCH_ASSOC);
    if (!$rij) error('Niet gevonden', 404);

    $finaleNaam   = $nieuweNaam !== null && $nieuweNaam !== '' ? $nieuweNaam : $rij['naam'];
    $finaleMacros = $macros ?: json_decode($rij['macros'], true);
    $finaleHash   = hash('sha256', strtolower($finaleNaam));

    if ($finaleHash !== $hash) {
        $check = db()->prepare('SELECT 1 FROM ingredient_macros_cache WHERE naam_hash = ?');
        $check->execute([$finaleHash]);
        if ($check->fetchColumn()) error('Een entry met deze naam bestaat al', 409);
    }

    db()->prepare(
        'UPDATE ingredient_macros_cache
         SET naam_hash = ?, naam = ?, macros = ?, bijgewerkt_op = NOW()
         WHERE naam_hash = ?'
    )->execute([$finaleHash, $finaleNaam, json_encode($finaleMacros), $hash]);

    json([
        'ok'        => true,
        'naam_hash' => $finaleHash,
        'naam'      => $finaleNaam,
        'macros'    => $finaleMacros,
    ]);
}

// DELETE /api/cache/{hash}
if ($methode === 'DELETE' && $hash) {
    db()->prepare('DELETE FROM ingredient_macros_cache WHERE naam_hash = ?')->execute([$hash]);
    json(['ok' => true]);
}

error('Methode niet toegestaan', 405);
