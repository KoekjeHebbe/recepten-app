<?php
/**
 * Colruyt-koppeling (Xtra-boodschappenlijst + productmacro's).
 *
 * Alles wat Colruyt zelf aanspreekt gebeurt in de browser van de gebruiker
 * (public/colruyt-helper.js, gestart via een bladwijzer op colruyt.be). Deze
 * server bewaart enkel de boodschappenlijst, de gekozen producten per
 * ingrediënt, en haalt macro's op bij Open Food Facts via de streepjescode.
 *
 * App (JWT):
 *   GET    /api/colruyt/sleutel            → persoonlijke sleutel voor de bladwijzer
 *   POST   /api/colruyt/sleutel            → nieuwe sleutel (oude vervalt)
 *   PUT    /api/colruyt/lijst              { items: [...] }  huidige boodschappenlijst
 *   GET    /api/colruyt/koppelingen        → gekozen producten per ingrediënt
 *   DELETE /api/colruyt/koppelingen/{ingr} → koppeling vergeten
 * Helper op colruyt.be (?k=<sleutel>):
 *   GET    /api/colruyt/lijst?k=           → { items, koppelingen }
 *   POST   /api/colruyt/koppelingen?k=     { koppelingen: [{ ingredient, eenheden, product }] }
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/eenheden.php';
require_once __DIR__ . '/voeding.php';

const COLRUYT_ORIGIN = 'https://www.colruyt.be';
$pad     = trim($_SERVER['PATH_INFO'] ?? '', '/');
$delen   = $pad === '' ? [] : explode('/', $pad);
$route   = $delen[0] ?? '';
$methode = $_SERVER['REQUEST_METHOD'];
$viaHelper = ($_SERVER['HTTP_ORIGIN'] ?? '') === COLRUYT_ORIGIN;

if ($viaHelper) {
    header('Access-Control-Allow-Origin: ' . COLRUYT_ORIGIN);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
    if ($methode === 'OPTIONS') { http_response_code(204); exit; }
} else {
    cors();
}

function colruytTabellen(): void {
    $pdo = db();
    $pdo->exec('CREATE TABLE IF NOT EXISTS colruyt_sleutels (
        gebruiker_id INT PRIMARY KEY,
        sleutel CHAR(40) NOT NULL UNIQUE,
        aangemaakt_op TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $pdo->exec('CREATE TABLE IF NOT EXISTS colruyt_lijsten (
        eigenaar_id INT PRIMARY KEY,
        data LONGTEXT NOT NULL,
        bijgewerkt_op TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $pdo->exec('CREATE TABLE IF NOT EXISTS colruyt_koppelingen (
        ingredient VARCHAR(190) PRIMARY KEY,
        product LONGTEXT NOT NULL,
        macros LONGTEXT NULL,
        macros_bron VARCHAR(255) NULL,
        bijgewerkt_op TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
}
colruytTabellen();

/** Superadmins delen één huishouden (zelfde regel als het weekmenu). */
function lijstEigenaar(int $sub): int {
    if (defined('SUPERADMIN_IDS') && in_array($sub, SUPERADMIN_IDS, true)) return min(SUPERADMIN_IDS);
    return $sub;
}

function gebruikerUitSleutel(): int {
    $k = (string)($_GET['k'] ?? '');
    if (!preg_match('/^[a-f0-9]{40}$/', $k)) error('Ongeldige of ontbrekende sleutel', 401);
    $stmt = db()->prepare('SELECT gebruiker_id FROM colruyt_sleutels WHERE sleutel = ?');
    $stmt->execute([$k]);
    $id = $stmt->fetchColumn();
    if (!$id) error('Onbekende sleutel — maak een nieuwe bladwijzer in de app', 401);
    return (int)$id;
}

function ingredientSleutel(string $naam): string {
    return mb_substr(mb_strtolower(trim($naam)), 0, 190);
}

function alleKoppelingen(): array {
    $uit = [];
    foreach (db()->query('SELECT ingredient, product, macros, macros_bron, bijgewerkt_op FROM colruyt_koppelingen ORDER BY ingredient') as $r) {
        $uit[] = [
            'ingredient'    => $r['ingredient'],
            'product'       => json_decode($r['product'], true),
            'macros'        => $r['macros'] ? json_decode($r['macros'], true) : null,
            'macros_bron'   => $r['macros_bron'],
            'bijgewerkt_op' => $r['bijgewerkt_op'],
        ];
    }
    return $uit;
}

/**
 * Macro's per 100 g/ml via Open Food Facts. Colruyt geeft GTIN's van 14 cijfers;
 * OFF gebruikt EAN-13. Eerste GTIN met alle vier de waarden wint.
 */
function macrosViaOpenFoodFacts(array $gtins): ?array {
    foreach (array_slice($gtins, 0, 4) as $gtin) {
        $code = ltrim(preg_replace('/\D/', '', (string)$gtin), '0');
        if (strlen($code) < 8) continue;
        $code = str_pad($code, 13, '0', STR_PAD_LEFT);
        $ch = curl_init("https://world.openfoodfacts.org/api/v2/product/$code.json?fields=product_name,brands,nutriments");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_USERAGENT      => 'TheNextPrepisode-recepten/1.0 (thenextprepisode.minglemurders.com)',
        ]);
        $resp = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if (!$resp || $status !== 200) continue;
        $j = json_decode($resp, true);
        $n = $j['product']['nutriments'] ?? null;
        if (!$n) continue;
        $velden = ['calorieen' => 'energy-kcal_100g', 'koolhydraten' => 'carbohydrates_100g', 'eiwitten' => 'proteins_100g', 'vetten' => 'fat_100g'];
        $macros = [];
        foreach ($velden as $doel => $bron) {
            if (!isset($n[$bron]) || !is_numeric($n[$bron])) continue 2;
            $macros[$doel] = round((float)$n[$bron], 2);
        }
        return ['macros' => $macros, 'bron' => "Open Food Facts $code"];
    }
    return null;
}

/**
 * Zet de productmacro's in de macro-cache en in elk recept dat dit ingrediënt
 * in g of ml gebruikt; herbereken die recepten (en recepten die ze als onderdeel gebruiken).
 */
function pasMacrosToe(string $ingredient, array $macros): int {
    $pdo = db();
    $insert = $pdo->prepare(
        'INSERT INTO ingredient_macros_cache (naam_hash, naam, macros) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE macros = VALUES(macros), bijgewerkt_op = NOW()'
    );
    $gebruiktIn = [];
    $alle = $pdo->query('SELECT id, data FROM recepten')->fetchAll(PDO::FETCH_KEY_PAIR);
    $upd = $pdo->prepare('UPDATE recepten SET data = ?, bijgewerkt_op = bijgewerkt_op WHERE id = ?');
    $gewijzigd = [];

    foreach ($alle as $id => $json) {
        $d = json_decode($json, true);
        $aangepast = false;
        foreach ($d['ingredienten'] ?? [] as $i => $ing) {
            if (ingredientSleutel($ing['naam'] ?? '') !== $ingredient) continue;
            $canon = canonischeEenheid($ing['eenheid'] ?? '');
            if (!in_array($canon, ['g', 'ml'], true)) continue;
            $gebruiktIn[$canon] = true;
            $d['ingredienten'][$i]['macros_referentie'] = $macros;
            $aangepast = true;
        }
        if ($aangepast) {
            herbereken_voedingswaarden($d);
            $upd->execute([json_encode($d, JSON_UNESCAPED_UNICODE), $id]);
            $gewijzigd[$id] = true;
        }
    }

    // Ouder-recepten die een gewijzigd recept als onderdeel gebruiken
    if ($gewijzigd) {
        foreach ($alle as $id => $json) {
            if (isset($gewijzigd[$id])) continue;
            $d = json_decode($json, true);
            $raakt = false;
            foreach ($d['onderdelen'] ?? [] as $od) {
                if (isset($gewijzigd[$od['recept_id'] ?? ''])) { $raakt = true; break; }
            }
            if ($raakt) {
                herbereken_voedingswaarden($d);
                $upd->execute([json_encode($d, JSON_UNESCAPED_UNICODE), $id]);
            }
        }
    }

    // Cache: altijd voor gram, plus ml als het ingrediënt ergens in volume staat
    foreach (array_unique(array_merge(['g'], array_keys($gebruiktIn))) as $canon) {
        $insert->execute([cacheSleutel($ingredient, $canon), "$ingredient ($canon)", json_encode($macros)]);
    }
    return count($gewijzigd);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

if ($route === 'sleutel' && in_array($methode, ['GET', 'POST'], true)) {
    $g = vereisLogin();
    $sub = (int)$g['sub'];
    $stmt = db()->prepare('SELECT sleutel FROM colruyt_sleutels WHERE gebruiker_id = ?');
    $stmt->execute([$sub]);
    $sleutel = $stmt->fetchColumn();
    if (!$sleutel || $methode === 'POST') {
        $sleutel = bin2hex(random_bytes(20));
        db()->prepare('INSERT INTO colruyt_sleutels (gebruiker_id, sleutel) VALUES (?, ?)
                       ON DUPLICATE KEY UPDATE sleutel = VALUES(sleutel), aangemaakt_op = NOW()')
            ->execute([$sub, $sleutel]);
    }
    json(['sleutel' => $sleutel]);
}

if ($route === 'lijst' && $methode === 'PUT') {
    $g = vereisLogin();
    $items = body()['items'] ?? null;
    if (!is_array($items)) error('items ontbreekt');
    $schoon = [];
    foreach (array_slice($items, 0, 300) as $it) {
        if (!is_array($it) || trim((string)($it['naam'] ?? '')) === '') continue;
        $hv = [];
        foreach ((array)($it['hoeveelheden'] ?? []) as $h) {
            if (!is_array($h) || !is_numeric($h['hoeveelheid'] ?? null)) continue;
            $hv[] = ['hoeveelheid' => (float)$h['hoeveelheid'], 'eenheid' => (string)($h['eenheid'] ?? '')];
        }
        $schoon[] = [
            'naam'         => mb_substr(trim((string)$it['naam']), 0, 190),
            'hoeveelheden' => $hv,
            'voorraadkast' => !empty($it['voorraadkast']),
            'categorie'    => mb_substr((string)($it['categorie'] ?? ''), 0, 60),
        ];
    }
    db()->prepare('INSERT INTO colruyt_lijsten (eigenaar_id, data) VALUES (?, ?)
                   ON DUPLICATE KEY UPDATE data = VALUES(data)')
        ->execute([lijstEigenaar((int)$g['sub']), json_encode($schoon, JSON_UNESCAPED_UNICODE)]);
    json(['ok' => true, 'aantal' => count($schoon)]);
}

if ($route === 'lijst' && $methode === 'GET') {
    $eigenaar = lijstEigenaar(gebruikerUitSleutel());
    $stmt = db()->prepare('SELECT data, bijgewerkt_op FROM colruyt_lijsten WHERE eigenaar_id = ?');
    $stmt->execute([$eigenaar]);
    $rij = $stmt->fetch(PDO::FETCH_ASSOC);
    $koppelingen = [];
    foreach (alleKoppelingen() as $k) $koppelingen[$k['ingredient']] = $k['product'];
    json([
        'items'         => $rij ? json_decode($rij['data'], true) : [],
        'bijgewerkt_op' => $rij['bijgewerkt_op'] ?? null,
        'koppelingen'   => $koppelingen,
    ]);
}

if ($route === 'koppelingen' && $methode === 'POST') {
    gebruikerUitSleutel();
    $lijst = body()['koppelingen'] ?? null;
    if (!is_array($lijst)) error('koppelingen ontbreekt');
    $upsert = db()->prepare(
        'INSERT INTO colruyt_koppelingen (ingredient, product, macros, macros_bron) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE product = VALUES(product), macros = VALUES(macros), macros_bron = VALUES(macros_bron)'
    );
    $resultaat = [];
    foreach (array_slice($lijst, 0, 100) as $k) {
        $ingredient = ingredientSleutel((string)($k['ingredient'] ?? ''));
        $p = $k['product'] ?? null;
        if ($ingredient === '' || !is_array($p) || empty($p['id'])) continue;
        $product = [
            'id'         => (string)$p['id'],
            'naam'       => mb_substr((string)($p['naam'] ?? ''), 0, 200),
            'merk'       => mb_substr((string)($p['merk'] ?? ''), 0, 100),
            'inhoud'     => mb_substr((string)($p['inhoud'] ?? ''), 0, 50),
            'afbeelding' => preg_match('#^https://static\.colruytgroup\.com/#', (string)($p['afbeelding'] ?? '')) ? $p['afbeelding'] : null,
            'gtin'       => array_values(array_filter(array_map('strval', (array)($p['gtin'] ?? [])), fn($g) => preg_match('/^\d{8,14}$/', $g))),
        ];

        // Zelfde product als vorige keer → macro's niet opnieuw ophalen
        $oud = db()->prepare('SELECT product, macros, macros_bron FROM colruyt_koppelingen WHERE ingredient = ?');
        $oud->execute([$ingredient]);
        $vorige = $oud->fetch(PDO::FETCH_ASSOC);
        if ($vorige && (json_decode($vorige['product'], true)['id'] ?? null) === $product['id'] && $vorige['macros']) {
            $upsert->execute([$ingredient, json_encode($product, JSON_UNESCAPED_UNICODE), $vorige['macros'], $vorige['macros_bron']]);
            $resultaat[] = ['ingredient' => $ingredient, 'macros' => 'ongewijzigd'];
            continue;
        }

        $off = $product['gtin'] ? macrosViaOpenFoodFacts($product['gtin']) : null;
        $upsert->execute([
            $ingredient,
            json_encode($product, JSON_UNESCAPED_UNICODE),
            $off ? json_encode($off['macros']) : null,
            $off['bron'] ?? null,
        ]);
        $recepten = $off ? pasMacrosToe($ingredient, $off['macros']) : 0;
        $resultaat[] = ['ingredient' => $ingredient, 'macros' => $off ? 'bijgewerkt' : 'niet gevonden', 'recepten' => $recepten];
    }
    json(['ok' => true, 'resultaat' => $resultaat]);
}

if ($route === 'koppelingen' && $methode === 'GET') {
    vereisLogin();
    json(['koppelingen' => alleKoppelingen()]);
}

if ($route === 'koppelingen' && $methode === 'DELETE' && isset($delen[1])) {
    vereisLogin();
    db()->prepare('DELETE FROM colruyt_koppelingen WHERE ingredient = ?')
        ->execute([ingredientSleutel(urldecode($delen[1]))]);
    json(['ok' => true]);
}

error('Niet gevonden', 404);
