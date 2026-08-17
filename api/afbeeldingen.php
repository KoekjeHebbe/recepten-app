<?php
/**
 * Afbeelding-upload voor recepten.
 * POST /api/afbeeldingen  { afbeelding: base64, media_type: "image/jpeg" }  (login)
 *   → { url: "https://…/uploads/recepten/<hash>.webp" }
 *
 * De client comprimeert al (canvas, max 1600px, JPEG); hier hercoderen we als
 * vangnet nogmaals met GD naar WebP (max 1600px, kwaliteit 80). Bestandsnaam is
 * een content-hash: dezelfde foto twee keer uploaden kost geen extra opslag.
 */
require_once __DIR__ . '/config.php';
cors();
vereisLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Methode niet toegestaan', 405);
if (!extension_loaded('gd')) error('Afbeelding-upload niet beschikbaar op de server', 503);

const UPLOAD_DIR  = __DIR__ . '/../uploads/recepten';
const UPLOAD_PAD  = '/uploads/recepten'; // publiek pad
const MAX_BYTES   = 8 * 1024 * 1024;     // na client-compressie ruim voldoende
const MAX_DIM     = 1600;
const WEBP_KWALITEIT = 80;

$data   = body();
$base64 = (string)($data['afbeelding'] ?? '');
if ($base64 === '') error('Geen afbeelding meegestuurd');
if (strlen($base64) > MAX_BYTES * 1.4) error('Afbeelding te groot (max ~8MB).', 413);

$binair = base64_decode($base64, true);
if ($binair === false) error('Ongeldige afbeeldingsdata');

$info = @getimagesizefromstring($binair);
if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) {
    error('Bestand is geen geldige afbeelding (JPG, PNG, WEBP of GIF).', 422);
}

$bron = @imagecreatefromstring($binair);
if (!$bron) error('Kon de afbeelding niet verwerken.', 422);

// EXIF-rotatie van telefoonfoto's rechtzetten (alleen JPEG heeft EXIF)
if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
    $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode($binair));
    $orientatie = (int)($exif['Orientation'] ?? 1);
    if (in_array($orientatie, [3, 6, 8], true)) {
        $graden = [3 => 180, 6 => -90, 8 => 90][$orientatie];
        $gedraaid = imagerotate($bron, $graden, 0);
        if ($gedraaid) { imagedestroy($bron); $bron = $gedraaid; }
    }
}

$b = imagesx($bron);
$h = imagesy($bron);
$schaal = min(1, MAX_DIM / max($b, $h));
$nb = max(1, (int)round($b * $schaal));
$nh = max(1, (int)round($h * $schaal));

$doel = imagecreatetruecolor($nb, $nh);
// Witte achtergrond zodat transparantie niet zwart wordt
$wit = imagecolorallocate($doel, 255, 255, 255);
imagefill($doel, 0, 0, $wit);
imagecopyresampled($doel, $bron, 0, 0, 0, 0, $nb, $nh, $b, $h);
imagedestroy($bron);

if (!is_dir(UPLOAD_DIR) && !mkdir(UPLOAD_DIR, 0755, true)) {
    error('Kon de upload-map niet aanmaken.', 500);
}

ob_start();
imagewebp($doel, null, WEBP_KWALITEIT);
$webp = ob_get_clean();
imagedestroy($doel);
if (!$webp) error('Compressie mislukt.', 500);

$naam = sha1($webp) . '.webp';
$pad  = UPLOAD_DIR . '/' . $naam;
if (!file_exists($pad) && file_put_contents($pad, $webp) === false) {
    error('Kon de afbeelding niet opslaan.', 500);
}

$schema = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host   = $_SERVER['HTTP_HOST'] ?? 'thenextprepisode.minglemurders.com';
json([
    'url'    => "$schema://$host" . UPLOAD_PAD . '/' . $naam,
    'breedte'=> $nb,
    'hoogte' => $nh,
    'bytes'  => strlen($webp),
], 201);
