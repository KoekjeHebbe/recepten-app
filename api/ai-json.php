<?php
/**
 * JSON uit een AI-antwoord halen. Gemini levert soms een correct object en
 * herhaalt daarna losse fragmenten ("}}}\n\":0}}}"), of zet rauwe regeleinden
 * in strings. Daarom: het EERSTE volledige object (met aandacht voor strings),
 * controletekens vervangen, en pas als dat faalt de oude "eerste { tot laatste }".
 */
if (!function_exists('aiJsonObject')) {
    function aiJsonObject(string $tekst): ?array {
        $start = strpos($tekst, '{');
        if ($start === false) return null;

        $kandidaten = [];
        $diepte = 0; $inString = false; $escape = false; $n = strlen($tekst);
        for ($i = $start; $i < $n; $i++) {
            $c = $tekst[$i];
            if ($inString) {
                if ($escape) $escape = false;
                elseif ($c === '\\') $escape = true;
                elseif ($c === '"') $inString = false;
                continue;
            }
            if ($c === '"') $inString = true;
            elseif ($c === '{') $diepte++;
            elseif ($c === '}' && --$diepte === 0) { $kandidaten[] = substr($tekst, $start, $i - $start + 1); break; }
        }
        $einde = strrpos($tekst, '}');
        if ($einde !== false && $einde > $start) $kandidaten[] = substr($tekst, $start, $einde - $start + 1);

        foreach ($kandidaten as $k) {
            $d = json_decode(preg_replace('/[\x00-\x1F]+/', ' ', $k), true);
            if (is_array($d)) return $d;
        }
        return null;
    }
}
