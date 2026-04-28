<?php
require_once __DIR__ . '/config.php';
cors();

$gebruiker = vereisLogin();
$methode   = $_SERVER['REQUEST_METHOD'];

const GELDIGE_DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

/**
 * Wie deelt het weekmenu? Superadmins delen één huishoudenmenu (de laagste
 * superadmin-id), iedereen anders heeft hun eigen.
 */
function weekmenuEigenaar(array $gebruiker): int {
    $sub = (int) $gebruiker['sub'];
    if (defined('SUPERADMIN_IDS') && in_array($sub, SUPERADMIN_IDS, true)) {
        return min(SUPERADMIN_IDS);
    }
    return $sub;
}

/**
 * Zorg dat het menu een geldige WeekMenu is: alleen bekende dagen,
 * elk item heeft string recept_id en porties > 0.
 */
function normaliseerMenu($menu): array {
    if (!is_array($menu)) return [];
    $resultaat = [];
    foreach (GELDIGE_DAGEN as $dag) {
        $resultaat[$dag] = [];
        $items = $menu[$dag] ?? [];
        if (!is_array($items)) continue;
        foreach ($items as $item) {
            if (!is_array($item)) continue;
            $rid = isset($item['recept_id']) ? trim((string)$item['recept_id']) : '';
            $por = isset($item['porties']) ? (float)$item['porties'] : 0;
            if ($rid === '' || $por <= 0) continue;
            $resultaat[$dag][] = ['recept_id' => $rid, 'porties' => $por];
        }
    }
    return $resultaat;
}

$eigenaar = weekmenuEigenaar($gebruiker);

if ($methode === 'GET') {
    $stmt = db()->prepare('SELECT data FROM weekmenus WHERE eigenaar_id = ?');
    $stmt->execute([$eigenaar]);
    $rij = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$rij) {
        $leeg = [];
        foreach (GELDIGE_DAGEN as $d) $leeg[$d] = [];
        json(['menu' => $leeg]);
    }
    $menu = normaliseerMenu(json_decode($rij['data'], true));
    json(['menu' => $menu]);
}

if ($methode === 'PUT') {
    $body = body();
    $menu = normaliseerMenu($body['menu'] ?? []);
    db()->prepare(
        'INSERT INTO weekmenus (eigenaar_id, data) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), bijgewerkt_op = NOW()'
    )->execute([$eigenaar, json_encode($menu, JSON_UNESCAPED_UNICODE)]);
    json(['ok' => true]);
}

error('Methode niet toegestaan', 405);
