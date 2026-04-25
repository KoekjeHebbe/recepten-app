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

// Google API key voor foto-import (maak aan op aistudio.google.com)
define('GOOGLE_API_KEY', 'AIza...');

// Edamam Nutrition Analysis API (https://developer.edamam.com/)
define('EDAMAM_APP_ID',  'jouw_edamam_app_id');
define('EDAMAM_APP_KEY', 'jouw_edamam_app_key');

// Superadmins — gebruiker-ID's die alle recepten mogen bewerken/verwijderen
// Zoek de ID's op in de tabel `gebruikers`
define('SUPERADMIN_IDS', [1, 2]);
