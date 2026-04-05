<?php
require_once __DIR__ . '/config.php';
cors();

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
    if ((int)$rij['aangemaakt_door'] !== (int)$gebruiker['sub']) error('Geen toegang', 403);

    // Zorg dat id niet verandert
    $data['id'] = $receptId;

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
    if ((int)$rij['aangemaakt_door'] !== (int)$gebruiker['sub']) error('Geen toegang', 403);

    db()->prepare('DELETE FROM favorieten WHERE recept_id = ?')->execute([$receptId]);
    db()->prepare('DELETE FROM recepten WHERE id = ?')->execute([$receptId]);
    json(['ok' => true]);
}

error('Methode niet toegestaan', 405);
