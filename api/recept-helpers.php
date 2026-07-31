<?php
/**
 * Gedeelde helpers voor recept-import (Gemini + eenheden).
 * Definities zijn guarded met function_exists() zodat ze niet botsen met de
 * lokale kopieën in importeer.php / foto.php.
 */

if (!function_exists('canoniseerEenheid')) {
    /** Breng een (mogelijk uitgeschreven) eenheid terug naar een canonieke code. */
    function canoniseerEenheid(string $e): string {
        $e = strtolower(trim($e));
        if ($e === '') return '';
        static $map = [
            'g'=>'g','gram'=>'g','grammen'=>'g','gr'=>'g',
            'kg'=>'kg','kilo'=>'kg','kilogram'=>'kg',
            'ml'=>'ml','milliliter'=>'ml',
            'l'=>'l','liter'=>'l','ltr'=>'l',
            'el'=>'el','eetlepel'=>'el','eetlepels'=>'el','tbsp'=>'el','tablespoon'=>'el',
            'tl'=>'tl','theelepel'=>'tl','theelepels'=>'tl','tsp'=>'tl','teaspoon'=>'tl',
            'kl'=>'kl','koffielepel'=>'kl',
            'cup'=>'cup','cups'=>'cup','kop'=>'cup',
            'stuk'=>'stuk','stuks'=>'stuk','st'=>'stuk','piece'=>'stuk','pieces'=>'stuk',
            'teen'=>'teen','tenen'=>'teen','teentje'=>'teen','teentjes'=>'teen','clove'=>'teen','cloves'=>'teen',
            'plak'=>'plak','plakken'=>'plak','plakje'=>'plak','plakjes'=>'plak','slice'=>'plak','slices'=>'plak',
            'sneetje'=>'sneetje','sneetjes'=>'sneetje','snee'=>'sneetje',
            'handvol'=>'handvol','handje'=>'handvol','handful'=>'handvol',
            'snufje'=>'snufje','snuf'=>'snufje','pinch'=>'snufje',
        ];
        return $map[$e] ?? '';
    }
}

if (!function_exists('geminiGenerateChain')) {
    /**
     * Roep Gemini aan via een modelketen. flash-lite raakt bij drukte tijdelijk
     * overbelast (HTTP 503); dan neemt flash het over. Geeft de body terug bij
     * HTTP 200, anders null.
     */
    function geminiGenerateChain(string $payload, array $modellen = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'], int $pogingenPerModel = 2): ?string {
        foreach ($modellen as $model) {
            $apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=" . GOOGLE_API_KEY;
            for ($i = 0; $i < $pogingenPerModel; $i++) {
                $ch = curl_init($apiUrl);
                curl_setopt_array($ch, [
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => $payload,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 60,
                    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                ]);
                $resp = curl_exec($ch);
                $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                if ($resp && $code === 200) return $resp;
                if ($i < $pogingenPerModel - 1) usleep(700000 * ($i + 1));
            }
        }
        return null;
    }
}

if (!function_exists('geminiTekstUitAntwoord')) {
    /** Pak de eerste non-thought tekst-part uit een Gemini-antwoord. */
    function geminiTekstUitAntwoord(?string $resp): string {
        if (!$resp) return '';
        $d = json_decode($resp, true);
        foreach (($d['candidates'][0]['content']['parts'] ?? []) as $p) {
            if (!empty($p['text']) && empty($p['thought'])) return $p['text'];
        }
        return '';
    }
}

if (!function_exists('normaliseerGeimporteerdIngredient')) {
    /**
     * Maak van een door Gemini geleverd ingrediënt een schone rij:
     * getal + canonieke eenheid, ook als het model een string ("500 g") teruggeeft.
     * Geeft null terug als er geen bruikbare naam is.
     */
    function normaliseerGeimporteerdIngredient(array $ing): ?array {
        $naam = trim((string)($ing['naam'] ?? ''));
        if ($naam === '') return null;

        $hoeveelheid = null;
        $eenheid = canoniseerEenheid((string)($ing['eenheid'] ?? ''));

        if (isset($ing['hoeveelheid']) && is_numeric($ing['hoeveelheid'])) {
            $hoeveelheid = (float)$ing['hoeveelheid'];
        } elseif (!empty($ing['hoeveelheid']) && is_string($ing['hoeveelheid'])) {
            $s = str_replace(',', '.', trim($ing['hoeveelheid']));
            if (preg_match('/^([\d.]+)\s*([a-zA-Z]+)?/', $s, $m)) {
                $hoeveelheid = (float)$m[1];
                if ($eenheid === '' && !empty($m[2])) $eenheid = canoniseerEenheid($m[2]);
            }
        }

        $groep = trim((string)($ing['groep'] ?? ''));
        return [
            'naam'         => $naam,
            'hoeveelheid'  => $hoeveelheid,
            'eenheid'      => $eenheid,
            'voorraadkast' => (bool)($ing['voorraadkast'] ?? false),
        ] + ($groep !== '' ? ['groep' => $groep] : []);
    }
}
