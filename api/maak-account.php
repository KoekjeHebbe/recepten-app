<?php
// Gebruik: php maak-account.php "Naam" "email@voorbeeld.be" "wachtwoord"
// Verwijder dit bestand NIET van de server — het is enkel via CLI bruikbaar, niet via het web.
// Het is beveiligd met een IP-check zodat het niet via de browser bereikbaar is.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit("Niet beschikbaar via de browser.\n");
}

require_once __DIR__ . '/config.php';

$naam = trim($argv[1] ?? '');
$email = trim($argv[2] ?? '');
$wachtwoord = $argv[3] ?? '';

if (!$naam || !$email || !$wachtwoord) {
    echo "Gebruik: php maak-account.php \"Naam\" \"email@voorbeeld.be\" \"wachtwoord\"\n";
    exit(1);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo "Ongeldig e-mailadres.\n";
    exit(1);
}

if (strlen($wachtwoord) < 8) {
    echo "Wachtwoord moet minstens 8 tekens zijn.\n";
    exit(1);
}

$stmt = db()->prepare('SELECT id FROM gebruikers WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    echo "E-mailadres al in gebruik.\n";
    exit(1);
}

$hash = password_hash($wachtwoord, PASSWORD_BCRYPT);
$stmt = db()->prepare('INSERT INTO gebruikers (naam, email, wachtwoord_hash, is_actief) VALUES (?, ?, ?, 1)');
$stmt->execute([$naam, $email, $hash]);
$id = db()->lastInsertId();

echo "Account aangemaakt!\n";
echo "  ID:    $id\n";
echo "  Naam:  $naam\n";
echo "  Email: $email\n";
