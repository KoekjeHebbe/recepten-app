<?php
require_once __DIR__ . '/config.php';
cors();

$methode = $_SERVER['REQUEST_METHOD'];
$gebruiker = vereisLogin();
$gebruikerId = $gebruiker['sub'];

// GET /api/favorieten — alle favorieten van ingelogde gebruiker
if ($methode === 'GET') {
    $stmt = db()->prepare('SELECT recept_id FROM favorieten WHERE gebruiker_id = ?');
    $stmt->execute([$gebruikerId]);
    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
    json($ids);
}

// POST /api/favorieten — favoriet toevoegen
if ($methode === 'POST') {
    $data = body();
    $receptId = $data['recept_id'] ?? '';
    if (!$receptId) error('recept_id is verplicht');

    // Check of recept bestaat
    $stmt = db()->prepare('SELECT id FROM recepten WHERE id = ?');
    $stmt->execute([$receptId]);
    if (!$stmt->fetch()) error('Recept niet gevonden', 404);

    $stmt = db()->prepare('INSERT IGNORE INTO favorieten (gebruiker_id, recept_id) VALUES (?, ?)');
    $stmt->execute([$gebruikerId, $receptId]);
    json(['ok' => true], 201);
}

// DELETE /api/favorieten/{recept_id}
if ($methode === 'DELETE') {
    $receptId = trim($_SERVER['PATH_INFO'] ?? '', '/');
    if (!$receptId) error('recept_id is verplicht');

    $stmt = db()->prepare('DELETE FROM favorieten WHERE gebruiker_id = ? AND recept_id = ?');
    $stmt->execute([$gebruikerId, $receptId]);
    json(['ok' => true]);
}

error('Methode niet toegestaan', 405);
