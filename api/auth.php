<?php
require_once __DIR__ . '/config.php';
cors();

$methode = $_SERVER['REQUEST_METHOD'];
$pad = trim($_SERVER['PATH_INFO'] ?? '', '/');

// POST /api/auth/registreer
if ($methode === 'POST' && $pad === 'registreer') {
    $data = body();
    $naam = trim($data['naam'] ?? '');
    $email = trim($data['email'] ?? '');
    $wachtwoord = $data['wachtwoord'] ?? '';
    $code = trim($data['uitnodigingscode'] ?? '');

    if (!$naam || !$email || !$wachtwoord) error('Naam, email en wachtwoord zijn verplicht');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) error('Ongeldig e-mailadres');
    if (strlen($wachtwoord) < 8) error('Wachtwoord moet minstens 8 tekens zijn');
    if (!hash_equals(UITNODIGINGSCODE, $code)) error('Ongeldige uitnodigingscode', 403);

    $stmt = db()->prepare('SELECT id FROM gebruikers WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) error('E-mailadres al in gebruik');

    $hash = password_hash($wachtwoord, PASSWORD_BCRYPT);
    $stmt = db()->prepare('INSERT INTO gebruikers (naam, email, wachtwoord_hash, is_actief) VALUES (?, ?, ?, 1)');
    $stmt->execute([$naam, $email, $hash]);
    $id = (int) db()->lastInsertId();

    json(['token' => maakJwt($id, $naam), 'gebruiker' => ['id' => $id, 'naam' => $naam, 'email' => $email]], 201);
}

// POST /api/auth/login
if ($methode === 'POST' && $pad === 'login') {
    $data = body();
    $email = trim($data['email'] ?? '');
    $wachtwoord = $data['wachtwoord'] ?? '';

    if (!$email || !$wachtwoord) error('Email en wachtwoord zijn verplicht');

    $stmt = db()->prepare('SELECT id, naam, wachtwoord_hash, is_actief FROM gebruikers WHERE email = ?');
    $stmt->execute([$email]);
    $gebruiker = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$gebruiker || !password_verify($wachtwoord, $gebruiker['wachtwoord_hash'])) {
        error('Ongeldig e-mailadres of wachtwoord', 401);
    }
    if (!$gebruiker['is_actief']) {
        error('Dit account is gedeactiveerd', 403);
    }

    json(['token' => maakJwt((int)$gebruiker['id'], $gebruiker['naam']), 'gebruiker' => ['id' => (int)$gebruiker['id'], 'naam' => $gebruiker['naam'], 'email' => $email]]);
}

// GET /api/auth/mij
if ($methode === 'GET' && $pad === 'mij') {
    $gebruiker = vereisLogin();
    $stmt = db()->prepare('SELECT id, naam, email, aangemaakt_op FROM gebruikers WHERE id = ?');
    $stmt->execute([$gebruiker['sub']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) error('Gebruiker niet gevonden', 404);
    json($row);
}

error('Onbekend auth endpoint', 404);
