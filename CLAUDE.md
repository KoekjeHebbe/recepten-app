# Recepten App — CLAUDE.md

Project context voor Claude Code. Lees dit bij het starten van elke sessie.

---

## Projectoverzicht

Persoonlijke recepten-webapp met weekmenu, boodschappenlijst en macro-tracking.

- **Frontend**: React 18 + TypeScript + Vite, gehost op GitHub Pages (`KoekjeHebbe/recepten-app`)
- **Backend**: PHP REST API op DigitalOcean (`178.62.205.86`), pad: `/srv/users/thenextprepisode/apps/thenextprepisode/public/api/`
- **Database**: MySQL, database `recepten_api`
- **Live URL**: `https://thenextprepisode.minglemurders.com`
- **GitHub**: `https://github.com/KoekjeHebbe/recepten-app`

---

## Stack & tooling

| Onderdeel | Technologie |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Animaties | GSAP 3 (`useGSAP`) |
| Drag & drop | `@dnd-kit/core` |
| Auth | JWT in localStorage (`recepten-token`) |
| API-client | `src/api/client.ts` — wraps fetch met auth header |
| Macro-AI | Google Gemini `gemini-2.5-flash-lite` (geen thinking-model!) |
| DB-deploy | Paramiko (Python SSH/SFTP) voor directe serveruploads |

---

## Mapstructuur

```
api/                   PHP REST API (niet in .gitignore behalve secrets.php)
  config.php           DB-connectie, CORS, helper-functies (ini_set display_errors=0!)
  secrets.php          Credentials — NIET in git, alleen op server
  router.php           Endpoint routing via match()
  auth.php             Login / registratie (JWT)
  recepten.php         CRUD recepten + macro-logica
  cache.php            CRUD macro-cache (GET ondersteunt ?limit=N)
  importeer-nevo.php   CLI NEVO CSV-importer (niet meer via web)
  foto.php             Foto-upload
  favorieten.php       Favorieten per gebruiker

src/
  types/index.ts       Interfaces: Recept, Ingredient, Macros, Dag, ...
  lib/
    eenheden.ts        NAAR_CANONICAL, STAP, formateerHoeveelheid()
    categorieen.ts     Categorie-indeling boodschappenlijst
  store/
    auth.ts            useAuth() — login state
    weekmenu.ts        useWeekMenu() — localStorage
    aangepaste-recepten.ts  useRecepten() — gecombineerde recepten
    favorieten.ts      useFavorieten()
  pages/
    Home.tsx           Receptenoverzicht + zoeken
    ReceptDetail.tsx   Recept tonen + macro's + +/- knoppen per ingredient
    ReceptToevoegen.tsx  Recept aanmaken/bewerken
    Weekmenu.tsx       Weekplanning
    Boodschappen.tsx   Boodschappenlijst (gesorteerd, versleepbaar)
    Extras.tsx         Macro-cache beheer (zoek, limit, CRUD)
    Login.tsx
```

---

## Database

### `recepten`
| kolom | type |
|---|---|
| id | VARCHAR (slug) |
| data | JSON (volledig recept incl. ingrediënten + voedingswaarden) |
| aangemaakt_door | INT (FK gebruikers.id) |
| aangemaakt_op / bijgewerkt_op | TIMESTAMP |

### `ingredient_macros_cache`
| kolom | inhoud |
|---|---|
| naam_hash | SHA-256 van `strtolower(naam) \| canonical_eenheid` |
| naam | leesbare naam, bijv. `"kipfilet (g)"` |
| macros | JSON: `{calorieen, koolhydraten, eiwitten, vetten}` **per 100g/ml of per 1 stuk** |
| bijgewerkt_op | TIMESTAMP |

De cache bevat ~2337 entries (2328 uit NEVO 2025 v9.0, rest via Gemini).

---

## Macro-systeem

### Eenheden
- `g/kg` → canonical `g`; `ml/l/el/tl/kl/cup` → canonical `ml`; stuk/teen/plak/… → zichzelf
- `naarCanonischeFactor('el') = 15`, `('kg') = 1000`, enz.

### Cache-sleutel
```
SHA-256( strtolower(naam) + "|" + canonische_eenheid )
```

### Referentiehoeveelheid
- g/ml → macros per **100g/ml**
- stuk/teen/… → macros per **1 stuk**

### Berekeningsformule
```
totale_macro = macros_per_ref × (hoeveelheid × canonical_factor) / ref
```
- PHP: `herbereken_voedingswaarden()` in `recepten.php`
- Frontend: `berekendeTotalen` useMemo in `ReceptDetail.tsx`

### Cache-lookup volgorde
1. Exacte hash-match in DB
2. Fuzzy match: sliding-window LIKE + `similar_text()` ≥ 40% (bijv. "knolselderij" → "Selderij knol rauw")
3. Gemini API (enkel als 1 en 2 missen)
4. Fuzzy/Gemini-resultaat wordt opgeslagen onder eigen hash voor volgende keer

---

## Ingredient-interface

```ts
interface Ingredient {
  naam: string
  hoeveelheid: number | null      // getal (niet string!)
  eenheid: string                 // 'g', 'el', 'stuk', '', ...
  voorraadkast: boolean
  categorie?: string
  macros_referentie?: Macros | null  // per 100g/ml of per 1 stuk
}
```

Oude recepten met `"hoeveelheid": "3 el"` worden genormaliseerd door `normaliseerIngredient()` in `recepten.php`.

---

## Deployment

### Frontend
```bash
npm run build   # → dist/
git push        # GitHub Actions deployt naar GitHub Pages
```

### Backend (PHP-bestanden)
```python
import paramiko, os
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('178.62.205.86', username='root', password='Falador12?')
sftp = ssh.open_sftp()
sftp.put(os.path.join('api', 'bestand.php'), '/srv/users/thenextprepisode/apps/thenextprepisode/public/api/bestand.php')
```

### NEVO-database importeren (CLI op server)
```bash
php importeer-nevo.php /pad/naar/NEVO2025_v9.0.csv
# Met overschrijven: php importeer-nevo.php bestand.csv --overschrijf
```
NEVO 2025 v9.0 is al geïmporteerd. Kolommen: naam=4, kcal=12, prot=14, fat=19, cho=27 (pipe-separated, per 100g).

---

## Bekende valkuilen

- **`gemini-2.5-flash` is een thinking-model** — interne redenering verbruikt outputTokens waardoor JSON afgekapt wordt. Gebruik altijd `gemini-2.5-flash-lite`.
- **`display_errors` moet uit** — staat ingesteld in `config.php` via `ini_set("display_errors", 0)`. Als dit ontbreekt komen PHP-warnings als HTML vóór de JSON, wat de API breekt.
- **Cache-waarden zijn per 100g/ml, niet per 1g/ml** — de formule deelt door `ref` (100 of 1). Oude cache-entries (vóór april 2026) waren inconsistent en zijn gewist.
- **NEVO header-skip** — alle datarijen beginnen met `"NEVO-Online 2025 9.0"`. Sla alleen rij 1 over, niet alles dat met "NEVO" begint.
- **`secrets.php` bevat geen `<?php` tag** — was ooit het geval. Controleer bij serverfouten.

---

## Credentials (server)

| | |
|---|---|
| SSH | `root@178.62.205.86` / `Falador12?` |
| DB user | `recepten_user` |
| DB pass | `39cSVGVsYlnY3JHJvcQT!Aa` |
| DB naam | `recepten_api` |
| Gemini API key | In `secrets.php` op server |
