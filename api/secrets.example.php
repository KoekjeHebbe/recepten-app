<?php
// Kopieer dit bestand naar secrets.php en vul de echte waarden in.
// secrets.php mag NOOIT in de repository worden opgeslagen!

define('DB_HOST', 'localhost');
define('DB_NAME', 'naam_van_database');
define('DB_USER', 'db_gebruikersnaam');
define('DB_PASS', 'db_wachtwoord');

// Genereer met: php -r "echo bin2hex(random_bytes(32));"
define('JWT_SECRET_FIXED', 'vervang_dit_met_64_hex_tekens');

// Geheime code die nieuwe gebruikers nodig hebben om te registreren
define('UITNODIGINGSCODE', 'vervang_dit_met_een_geheime_code');

// Anthropic API key voor foto-import (maak aan op console.anthropic.com)
define('ANTHROPIC_API_KEY', 'sk-ant-...');
