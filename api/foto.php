<?php
require_once __DIR__ . '/config.php';
cors();
vereisLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Methode niet toegestaan', 405);
if (!defined('GOOGLE_API_KEY') || !GOOGLE_API_KEY) error('Foto-import niet geconfigureerd op de server', 503);

$data = body();
$base64 = $data['afbeelding'] ?? '';
$mediaType = $data['media_type'] ?? 'image/jpeg';

if (!$base64) error('Geen afbeelding meegestuurd');
if (!in_array($mediaType, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'])) error('Ongeldig afbeeldingsformaat');
if (strlen($base64) > 5_500_000) error('Afbeelding te groot (max ~4MB)');

$prompt = <<<'PROMPT'
Dit is een foto van een recept uit een kookboek of tijdschrift. Extraheer het recept en geef het terug als JSON in exact dit formaat:

{
  "titel": "Naam van het gerecht",
  "personen": 4,
  "ingredienten": [
    { "naam": "kipfilet", "hoeveelheid": "500 g", "voorraadkast": false },
    { "naam": "olijfolie", "hoeveelheid": "2 el", "voorraadkast": true }
  ],
  "bereiding": [
    "Verwarm de oven voor op 180°C.",
    "Meng alle ingrediënten..."
  ],
  "voedingswaarden": {
    "per_portie": { "calorieen": 450, "koolhydraten": 30, "eiwitten": 35, "vetten": 18 },
    "schatting": true
  }
}

Regels:
- voorraadkast = true voor: olie, azijn, zout, peper, kruiden, specerijen, bloem, suiker, boter
- hoeveelheid altijd als string (bijv. "2 el", "500 g", "1 teen") of null als niet vermeld
- bereiding: elke stap als aparte string, volledig uitgeschreven
- voedingswaarden: schat op basis van ingrediënten als niet vermeld, zet schatting op true
- Antwoord ALLEEN met de JSON, geen uitleg errond
PROMPT;

$payload = json_encode([
    'contents' => [[
        'parts' => [
            [
                'inline_data' => [
                    'mime_type' => $mediaType,
                    'data' => $base64,
                ],
            ],
            ['text' => $prompt],
        ],
    ]],
    'generationConfig' => [
        'temperature' => 0.1,
        'maxOutputTokens' => 2048,
    ],
]);

$apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . GOOGLE_API_KEY;

$ch = curl_init($apiUrl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
    ],
]);

$antwoord = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$antwoord) error('Kon de AI-service niet bereiken', 503);

$antwoordData = json_decode($antwoord, true);
if ($httpCode !== 200) {
    $msg = $antwoordData['error']['message'] ?? 'Onbekende fout bij AI-service';
    error('AI-fout: ' . $msg, 502);
}

$tekst = $antwoordData['candidates'][0]['content']['parts'][0]['text'] ?? '';
if (!$tekst) error('Geen antwoord ontvangen van AI-service', 502);

// Strip eventuele markdown code block
$tekst = preg_replace('/^```(?:json)?\s*/i', '', trim($tekst));
$tekst = preg_replace('/\s*```$/i', '', $tekst);

$recept = json_decode(trim($tekst), true);
if (!$recept || empty($recept['titel'])) error('Kon geen recept herkennen in de afbeelding. Probeer een duidelijkere foto.', 422);

// Normaliseer structuur
$recept['tags'] = [];
$recept['bron_url'] = null;
$recept['afbeelding_url'] = null;
if (!isset($recept['voedingswaarden']['totaal'])) {
    $pp = $recept['voedingswaarden']['per_portie'] ?? ['calorieen' => 0, 'koolhydraten' => 0, 'eiwitten' => 0, 'vetten' => 0];
    $p = $recept['personen'] ?? 4;
    $recept['voedingswaarden']['totaal'] = [
        'calorieen'     => ($pp['calorieen'] ?? 0) * $p,
        'koolhydraten'  => ($pp['koolhydraten'] ?? 0) * $p,
        'eiwitten'      => ($pp['eiwitten'] ?? 0) * $p,
        'vetten'        => ($pp['vetten'] ?? 0) * $p,
    ];
}
if (!isset($recept['voedingswaarden']['schatting'])) {
    $recept['voedingswaarden']['schatting'] = true;
}

json($recept);
