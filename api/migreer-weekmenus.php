<?php
// migreer-weekmenus.php — eenmalig: maakt de weekmenus-tabel.
// Te draaien via CLI op de server.

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("CLI alleen.\n");
}

require_once __DIR__ . '/config.php';

db()->exec(
    "CREATE TABLE IF NOT EXISTS weekmenus (
        eigenaar_id INT PRIMARY KEY,
        data JSON NOT NULL,
        bijgewerkt_op TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (eigenaar_id) REFERENCES gebruikers(id) ON DELETE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
);

$count = (int) db()->query('SELECT COUNT(*) FROM weekmenus')->fetchColumn();
echo "Tabel weekmenus klaar. Huidige rijen: $count\n";
