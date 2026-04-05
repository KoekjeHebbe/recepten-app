<?php
require_once __DIR__ . '/config.php';

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Strip /api/ prefix
$pad = preg_replace('#^/api/?#', '', $uri);
$pad = trim($pad, '/');
$segmenten = explode('/', $pad);
$endpoint = $segmenten[0] ?? '';

// Zet PATH_INFO zodat de losse bestanden het kunnen gebruiken
$rest = '/' . implode('/', array_slice($segmenten, 1));
$_SERVER['PATH_INFO'] = $rest === '/' ? '' : $rest;

match($endpoint) {
    'auth'       => require __DIR__ . '/auth.php',
    'recepten'   => require __DIR__ . '/recepten.php',
    'favorieten' => require __DIR__ . '/favorieten.php',
    'importeer'  => require __DIR__ . '/importeer.php',
    'foto'       => require __DIR__ . '/foto.php',
    ''           => json(['status' => 'ok', 'versie' => '1.0']),
    default      => error('Endpoint niet gevonden', 404),
};
