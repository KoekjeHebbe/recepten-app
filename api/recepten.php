<?php
require_once __DIR__ . '/config.php';
cors();

/**
 * Haal macronutriënten op voor alle ingrediënten via Gemini (één API-call).
 * Geeft een array terug van evenveel elementen als $ingredienten:
 * elk element is {calorieen, koolhydraten, eiwitten, vetten} of null bij fout.
 *
 * @param  array $ingredienten  Elk element heeft 'naam' en optioneel 'hoeveelheid'
 * @return array                Zelfde lengte als input
 */
function haalMacrosViaGemini(array $ingredienten): array {
    $count = count($ingredienten);
    $leeg  = array_fill(0, $count, null);

    if ($count === 0 || !defined('GOOGLE_API_KEY') || !GOOGLE_API_KEY) return $leeg;

    // Bouw de ingrediëntenlijst op
    $lijstRegels = [];
    foreach ($ingredienten as $i => $ing) {
        $str = trim(($ing['hoeveelheid'] ?? '') . ' ' . $ing['naam']);
        $lijstRegels[] = ($i + 1) . '. ' . $str;
    }
    $lijst = implode("\n", $lijstRegels);

    $prompt = "Bereken de macronutriënten voor elk ingrediënt hieronder in de opgegeven hoeveelheid.\n"
            . "Geef ALLEEN een JSON-array terug (geen uitleg, geen markdown), één object per ingrediënt in dezelfde volgorde:\n"
            . "[{\"calorieen\":0,\"koolhydraten\":0,\"eiwitten\":0,\"vetten\":0}, ...]\n"
            . "Alle waarden zijn gehele getallen (afgerond).\n\n"
            . "Ingrediënten:\n" . $lijst;

    $payload = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 512],
    ]);

    $apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . GOOGLE_API_KEY;
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if (!$resp) return $leeg;

    $respData = json_decode($resp, true);
    $parts    = $respData['candidates'][0]['content']['parts'] ?? [];
    $tekst    = '';
    foreach ($parts as $part) {
        if (!empty($part['text']) && empty($part['thought'])) { $tekst = $part['text']; break; }
    }

    // Extraheer de JSON-array uit de respons
    $s = strpos($tekst, '[');
    $e = strrpos($tekst, ']');
    if ($s === false || $e <= $s) return $leeg;

    $parsed = json_decode(substr($tekst, $s, $e - $s + 1), true);
    if (!is_array($parsed)) return $leeg;

    // Zet om naar genormaliseerd formaat, vul ontbrekende rijen aan met null
    $resultaat = [];
    for ($i = 0; $i < $count; $i++) {
        $m = $parsed[$i] ?? null;
        if (!is_array($m)) { $resultaat[] = null; continue; }
        $resultaat[] = [
            'calorieen'    => (int) round($m['calorieen']    ?? 0),
            'koolhydraten' => (int) round($m['koolhydraten'] ?? 0),
            'eiwitten'     => (int) round($m['eiwitten']     ?? 0),
            'vetten'       => (int) round($m['vetten']       ?? 0),
        ];
    }
    return $resultaat;
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

    // Haal macros op via Gemini voor alle ingrediënten in één call
    $macrosLijst = haalMacrosViaGemini($data['ingredienten']);
    foreach ($data['ingredienten'] as $i => &$ing) {
        $ing['macros_referentie'] = $macrosLijst[$i] ?? null;
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

    // Herbereken macros enkel voor ingrediënten zonder macros_referentie (nieuw toegevoegde)
    $nieuweIndexen = [];
    foreach ($data['ingredienten'] as $i => $ing) {
        if (!isset($ing['macros_referentie'])) $nieuweIndexen[] = $i;
    }
    if (!empty($nieuweIndexen)) {
        $nieuweIngrs = array_map(fn($i) => $data['ingredienten'][$i], $nieuweIndexen);
        $macrosLijst = haalMacrosViaGemini($nieuweIngrs);
        foreach ($nieuweIndexen as $pos => $origIdx) {
            $data['ingredienten'][$origIdx]['macros_referentie'] = $macrosLijst[$pos] ?? null;
        }
    }

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
