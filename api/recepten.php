<?php
require_once __DIR__ . '/config.php';
cors();

/**
 * Haal macronutriënten op via de Edamam Nutrition Analysis API.
 * Geeft een array terug met calorieen/koolhydraten/eiwitten/vetten voor de
 * opgegeven hoeveelheid, of null als de API mislukt / het ingrediënt niet herkent.
 *
 * @param  string $ingredientString  Bijv. "200g kipfilet" of "1 el olijfolie"
 * @return array|null
 */
function haalEdamamMacros(string $ingredientString): ?array {
    if (!defined('EDAMAM_APP_ID') || !defined('EDAMAM_APP_KEY')) return null;

    $url = 'https://api.edamam.com/api/nutrition-data?' . http_build_query([
        'app_id'  => EDAMAM_APP_ID,
        'app_key' => EDAMAM_APP_KEY,
        'ingr'    => $ingredientString,
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    $response = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode < 200 || $httpCode >= 300 || !$response) return null;

    $json = json_decode($response, true);
    $n    = $json['totalNutrients'] ?? [];
    // Edamam geeft HTTP 200 terug maar een leeg nutriëntenobject voor onbekende ingrediënten
    if (empty($n) || empty($json['calories'])) return null;

    return [
        'calorieen'    => (int) round($n['ENERC_KCAL']['quantity'] ?? 0),
        'koolhydraten' => (int) round($n['CHOCDF']['quantity']     ?? 0),
        'eiwitten'     => (int) round($n['PROCNT']['quantity']     ?? 0),
        'vetten'       => (int) round($n['FAT']['quantity']        ?? 0),
    ];
}

/**
 * Herbereken voedingswaarden.totaal en voedingswaarden.per_portie
 * op basis van de macros_referentie van de individuele ingrediënten.
 * Doet niets als geen enkel ingrediënt macros_referentie heeft.
 */
function herbereken_voedingswaarden(array &$data): void {
    $ingredienten = $data['ingredienten'] ?? [];
    $personen     = max(1, (int)($data['personen'] ?? 1));

    $totaal      = ['calorieen' => 0, 'koolhydraten' => 0, 'eiwitten' => 0, 'vetten' => 0];
    $heeftMacros = false;

    foreach ($ingredienten as $ing) {
        $macros = $ing['macros_referentie'] ?? null;
        if (!$macros) continue;
        $heeftMacros = true;
        foreach (['calorieen', 'koolhydraten', 'eiwitten', 'vetten'] as $key) {
            $totaal[$key] += (float)($macros[$key] ?? 0);
        }
    }

    if (!$heeftMacros) return;

    $data['voedingswaarden'] = [
        'totaal'     => array_map(fn($v) => (int) round($v), $totaal),
        'per_portie' => array_map(fn($v) => (int) round($v / $personen), $totaal),
        'schatting'  => false,
    ];
}

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

    // Haal macros op via Edamam voor elk ingrediënt
    foreach ($data['ingredienten'] as &$ing) {
        $ingrStr = trim(($ing['hoeveelheid'] ?? '') . ' ' . $ing['naam']);
        $ing['macros_referentie'] = haalEdamamMacros($ingrStr);
    }
    unset($ing);

    // Herbereken totale voedingswaarden op basis van ingrediënt-macros
    herbereken_voedingswaarden($data);

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

    // Herbereken macros: alleen voor ingrediënten zonder macros_referentie (bijv. nieuw toegevoegde)
    foreach ($data['ingredienten'] as &$ing) {
        if (isset($ing['macros_referentie'])) continue;
        $ingrStr = trim(($ing['hoeveelheid'] ?? '') . ' ' . $ing['naam']);
        $ing['macros_referentie'] = haalEdamamMacros($ingrStr);
    }
    unset($ing);

    herbereken_voedingswaarden($data);

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
