<?php
/**
 * Recept-import via geplakte tekst.
 * POST /api/tekst  { "tekst": "Ingredients ...\nMethod ..." }
 *
 * Zelfde uitvoer als /api/foto en /api/importeer, maar zonder OCR: de tekst gaat
 * rechtstreeks naar Gemini. Nauwkeuriger (geen leesfouten) en goedkoper.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/recept-helpers.php';
cors();
vereisLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Methode niet toegestaan', 405);
if (!defined('GOOGLE_API_KEY') || !GOOGLE_API_KEY) error('Tekst-import niet geconfigureerd op de server', 503);

$data  = body();
$tekst = trim((string)($data['tekst'] ?? ''));

if ($tekst === '') error('Geen tekst ontvangen');
if (mb_strlen($tekst) < 20) error('Te weinig tekst om een recept te herkennen.', 422);
if (mb_strlen($tekst) > 20000) error('Tekst is te lang (max ~20.000 tekens).', 413);

$prompt = "Hieronder staat de tekst van een recept. Extraheer het recept, VERTAAL alles naar het Nederlands en geef ALLEEN een JSON-object terug.\n"
    . "Als de tekst geen recept bevat, antwoord dan met: {\"geen_recept\":true}\n\n"
    . "Formaat:\n"
    . "{\"titel\":\"...\",\"personen\":4,\"ingredienten\":[{\"naam\":\"...\",\"hoeveelheid\":null,\"eenheid\":\"\",\"voorraadkast\":false,\"groep\":\"\"}],"
    . "\"bereiding\":[\"...\"],\"voedingswaarden\":{\"per_portie\":{\"calorieen\":0,\"koolhydraten\":0,\"eiwitten\":0,\"vetten\":0}}}\n\n"
    . "Regels:\n"
    . "- TAAL: titel, ingrediëntnamen en bereidingsstappen ALTIJD in het Nederlands, ook als de tekst Engels is. Behoud merknamen onveranderd.\n"
    . "- naam: KORT en kaal, alleen het ingrediënt zelf, zonder hoeveelheid en zonder snij-/bereidingsomschrijving. 'Onion — 150 g, diced' → {\"naam\":\"ui\",\"hoeveelheid\":150,\"eenheid\":\"g\"}. Snijwijze hoort in de bereiding (korte namen zijn nodig voor de macro-database en de boodschappenlijst).\n"
    . "- hoeveelheid: een GETAL of null. Fracties als decimaal (1/2 → 0.5, ¼ → 0.25). Bij een bereik het gemiddelde (520–560 ml → 540).\n"
    . "- eenheid: EXACT een code uit [g, kg, ml, l, el, tl, kl, cup, stuk, teen, plak, sneetje, handvol, snufje] of leeg. Gebruik de code, niet het woord ('g' niet 'gram'). tbsp → el, tsp → tl, clove → teen, slice → plak, pinch → snufje.\n"
    . "  Imperial → metric: 1 lb ≈ 454 g, 1 oz ≈ 28 g, 1 fl oz ≈ 30 ml, 1 quart ≈ 950 ml, 1 pint ≈ 470 ml.\n"
    . "- groep: de sectiekop waaronder het ingrediënt staat (bijv. 'Burgers', 'Slaw', 'Saus'). Geen kopjes in de tekst? Lege string. Verzin geen secties.\n"
    . "- voorraadkast = true voor olie, azijn, zout, peper, kruiden, specerijen, bloem, suiker en boter.\n"
    . "- personen: aantal porties uit de tekst (bij een bereik de laagste), anders 4.\n"
    . "- bereiding: elke stap een volledige Nederlandse zin, zonder stapnummers.\n"
    . "- voedingswaarden: gebruik de waarden uit de tekst als die er staan, anders een realistische schatting per portie. Gehele getallen.\n\n"
    . "Tekst:\n" . $tekst . "\n";

$payload = json_encode([
    'contents'         => [['parts' => [['text' => $prompt]]]],
    'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 8192, 'responseMimeType' => 'application/json'],
]);

$resp = geminiGenerateChain($payload);
if (!$resp) error('De AI-service is even overbelast. Probeer het zo dadelijk opnieuw.', 503);

$antwoordTekst = geminiTekstUitAntwoord($resp);
$s = strpos($antwoordTekst, '{');
$e = strrpos($antwoordTekst, '}');
if ($s === false || $e <= $s) error('Kon het recept niet uit de tekst halen. Probeer meer context mee te plakken.', 422);

$parsed = json_decode(substr($antwoordTekst, $s, $e - $s + 1), true);
if (!$parsed || !is_array($parsed)) error('Kon het recept niet uit de tekst halen.', 422);
if (!empty($parsed['geen_recept']) || empty($parsed['titel'])) {
    error('Geen recept herkend in deze tekst. Plak de ingrediënten én de bereiding mee.', 422);
}

// Ingrediënten normaliseren (getal + canonieke eenheid)
$ingredienten = [];
foreach (($parsed['ingredienten'] ?? []) as $ing) {
    if (!is_array($ing)) continue;
    $rij = normaliseerGeimporteerdIngredient($ing);
    if ($rij) $ingredienten[] = $rij;
}
if (empty($ingredienten)) error('Geen ingrediënten herkend in deze tekst.', 422);

$bereiding = array_values(array_filter(
    array_map(fn($r) => trim((string)$r), $parsed['bereiding'] ?? []),
    fn($r) => $r !== ''
));

$personen = max(1, (int)($parsed['personen'] ?? 4));

$pp = $parsed['voedingswaarden']['per_portie'] ?? [];
$cal = (int) round((float)($pp['calorieen'] ?? 0));
$kh  = (int) round((float)($pp['koolhydraten'] ?? 0));
$eiw = (int) round((float)($pp['eiwitten'] ?? 0));
$vet = (int) round((float)($pp['vetten'] ?? 0));

json([
    'titel'           => trim((string)$parsed['titel']),
    'personen'        => $personen,
    'afbeelding_url'  => null,
    'bron_url'        => null,
    'tags'            => [],
    'ingredienten'    => $ingredienten,
    'bereiding'       => $bereiding,
    'voedingswaarden' => [
        'per_portie' => ['calorieen' => $cal, 'koolhydraten' => $kh, 'eiwitten' => $eiw, 'vetten' => $vet],
        'totaal'     => ['calorieen' => $cal * $personen, 'koolhydraten' => $kh * $personen, 'eiwitten' => $eiw * $personen, 'vetten' => $vet * $personen],
        'schatting'  => true,
    ],
]);
