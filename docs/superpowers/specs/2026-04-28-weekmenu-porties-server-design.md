# Weekmenu — porties + account-scoped opslag

**Datum:** 2026-04-28
**Status:** Approved (brainstorming → ready for implementation plan)

## Probleem

Het weekmenu heeft drie tekortkomingen:

1. **Geen porties per dag.** Een recept dat voor 4 personen geschreven is, levert altijd dezelfde boodschappen op, ook als jullie maar met z'n tweeën eten op dinsdag.
2. **Browser-lokaal.** Het weekmenu staat in `localStorage`, dus laptop en telefoon zien verschillende menu's en je verliest het bij browser-resets.
3. **Buggy day-picker.** De dropdown waarin je een dag kiest sluit niet als verwacht.

## Beslissingen

| # | Vraag | Keuze |
|---|---|---|
| Q1 | Wie deelt een weekmenu? | **Superadmins delen één huishoudenmenu, andere users hebben hun eigen.** Geen aparte `huishouden_id` nodig — `SUPERADMIN_IDS` is al de bron van waarheid. |
| Q2 | Wat betekent `porties`? | **Aantal mensen dat eet.** Default = `recept.personen` (recept zoals bedoeld). Boodschappen schalen ingrediënten met `porties / recept.personen`. |

## Datamodel

```ts
// src/types/index.ts
export interface WeekmenuItem {
  recept_id: string
  porties: number   // aantal mensen dat eet die dag
}

export interface WeekMenu {
  [dag: string]: WeekmenuItem[]
}
```

Eerder was `WeekMenu[dag]` een `string[]` (alleen recept-id's). Nu wordt dat een array van objecten met `porties` per regel.

## Backend

### Schema

Nieuwe tabel — één JSON-rij per huishouden, conform het bestaande `recepten`-patroon:

```sql
CREATE TABLE weekmenus (
  eigenaar_id INT PRIMARY KEY,
  data JSON NOT NULL,
  bijgewerkt_op TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (eigenaar_id) REFERENCES gebruikers(id) ON DELETE CASCADE
);
```

Te creëren via `api/migreer-weekmenus.php` (CLI, eenmalig).

### Sharing

```php
function weekmenuEigenaar(array $gebruiker): int {
    $sub = (int) $gebruiker['sub'];
    if (defined('SUPERADMIN_IDS') && in_array($sub, SUPERADMIN_IDS, true)) {
        return min(SUPERADMIN_IDS);   // alle superadmins delen de laagste id
    }
    return $sub;
}
```

Dit is de enige plek waar de sharing-logica woont. Een toekomstig `huishouden_id`-veld zou enkel deze helper raken.

### API

Nieuw bestand `api/weekmenu.php`, gemount in `router.php` op `/weekmenu`:

| Method | Path | Body | Response |
|---|---|---|---|
| `GET`  | `/api/weekmenu` | — | `{ menu: WeekMenu }` |
| `PUT`  | `/api/weekmenu` | `{ menu: WeekMenu }` | `{ ok: true }` |

`PUT` is een full-replace — de client stuurt het complete menu. Eenvoudiger dan per-dag patches en de payload blijft klein. Beide endpoints `vereisLogin()`.

Server-side validatie:
- `data.menu[dag]` filteren op array-elementen met geldige `recept_id` (string) en `porties` (positieve number, > 0).
- Onbekende dagen droppen.

## Frontend store

`src/store/weekmenu.tsx` behoudt de Context-API-vorm; alleen de implementatie wisselt van localStorage naar API.

```ts
interface WeekMenuContext {
  menu: WeekMenu
  laden: boolean                                                  // initial fetch
  addToDay: (dag: Dag, recept_id: string, porties?: number) => void
  setPorties: (dag: Dag, recept_id: string, porties: number) => void
  removeFromDay: (dag: Dag, recept_id: string) => void
  clearDay: (dag: Dag) => void
  clearAll: () => void
}
```

**Lifecycle**:

1. Op mount (alleen als ingelogd): `GET /weekmenu` → state hydrateren.
2. Lokale mutators schrijven direct naar state (optimistic), gevolgd door een **debounced** `PUT /weekmenu` (~500 ms). Voorkomt een request per klik tijdens multi-add bursts.
3. **Eenmalige localStorage-migratie**: bij eerste hydrate, als de oude `recepten-weekmenu`-key een `string[]`-vorm bevat én de server-menu leeg is:
   - Lift elk id naar `{recept_id: id, porties: recept.personen}` (lookup via `useRecepten().alleRecepten`).
   - PUT naar server.
   - `localStorage.removeItem('recepten-weekmenu')`.
   - Slaat over als de server al data heeft (bv. al gemigreerd vanaf een ander apparaat).
4. Uitgelogde users krijgen een lege read-only stub. Bestaande UX ("log in om je weekmenu te gebruiken") dekt dit af.

**Default porties** in `addToDay`: als `porties` niet wordt meegegeven, neem `alleRecepten.find(r => r.id === recept_id)?.personen ?? 1`.

## UI-wijzigingen

### `ReceptDetail.tsx` — day-picker

Per dag in de dropdown een kleine porties-input naast de dag-rij:

```
[ ✓ ] maandag         [ 4 ]
[   ] dinsdag         [   ]
[ ✓ ] woensdag        [ 2 ]
```

- **Klik op dag-rij**: toggle add/remove. Bij add gebruikt het de waarde uit het input-veld (default = `recept.personen`).
- **Edit porties op een geselecteerde dag**: roept `setPorties(...)` live aan.
- **Edit porties op een niet-geselecteerde dag**: stagert lokaal; klik op de rij om toe te voegen. Visueel gedimde input op niet-geselecteerde dagen verduidelijkt dit.

**Bug-fix**: outside-click sluit de dropdown (zelfde patroon als `ReceptKiezer`'s `useEffect` met `mousedown`-listener). Klikken binnen de dropdown sluit niet — multi-day-adds in één opening blijven werken. Expliciete "Sluit"-knop onderaan vervalt.

### `Weekmenu.tsx`

Elke meal-rij krijgt een inline porties-editor in plaats van het statische `👥 {recept.personen}` badge:

```
Pasta Carbonara           [ − 4 + ]   ×
```

- `onChange` → `setPorties(...)`.
- Per-dag header toont `kcal` totaal voor de dag (porties al meegerekend), niet meer `kcal/pers.`.
- Berekening: `Σ recept.voedingswaarden.per_portie.calorieen × porties` per dag.

### `Boodschappen.tsx`

`groepeerIngredienten` accepteert nu een lijst `WeekmenuItem[]` (per dag samengevoegd) in plaats van plain `string[]`. Voor elk item:

```ts
const recept = alleRecepten.find(r => r.id === item.recept_id)
if (!recept || !recept.personen) continue
const factor = item.porties / recept.personen
for (const ing of recept.ingredienten) voegToe(map, ing, factor)
for (const od of recept.onderdelen ?? []) {
  const sub = alleRecepten.find(r => r.id === od.recept_id)
  if (!sub || !sub.personen) continue
  const subFactor = factor * (od.porties / sub.personen)
  for (const ing of sub.ingredienten) voegToe(map, ing, subFactor)
}
```

`voegToe` (al ingevoerd in de sub-recepten implementatie) accepteert al een `factor`-parameter. Bestaand concat-gedrag blijft: `"100 g + 50 g pasta"` — geen unit-aware sommatie.

`betrokkenRecepten` badge bovenin blijft zoals nu: één link per uniek recept-id (porties hebben geen invloed op welke recepten getoond worden).

## Bestanden

| Bestand | Wijziging |
|---|---|
| `src/types/index.ts` | `WeekmenuItem` interface; `WeekMenu` value type → `WeekmenuItem[]` |
| `src/store/weekmenu.tsx` | API-store + debounced PUT + localStorage-migratie + `setPorties` |
| `src/pages/ReceptDetail.tsx` | Porties-input per dag-rij; outside-click handler; "Sluit"-knop weg |
| `src/pages/Weekmenu.tsx` | Inline porties-editor; dag-totaal kcal × porties |
| `src/pages/Boodschappen.tsx` | `WeekmenuItem[]`-input; sub-recepten-factor times porties-factor |
| `api/weekmenu.php` | **nieuw** — GET + PUT + `weekmenuEigenaar` |
| `api/router.php` | mount `/weekmenu` |
| `api/migreer-weekmenus.php` | **nieuw** — CLI tabelcreatie |

Geen wijzigingen aan `Home.tsx`, `Nav.tsx`, recepten-API, `cache.php`. Geen frontend-routes erbij.

## Edge cases

| Scenario | Gedrag |
|---|---|
| Uitgelogd op weekmenu-pagina | Lege state + bestaande "log in"-CTA. Geen localStorage-fallback. |
| User wordt later superadmin | Persoonlijk menu raakt orphan; ze zien voortaan het huishoudenmenu. OK voor onze gebruikersbasis (alleen Maarten + Laura). |
| Recept in weekmenu wordt verwijderd | Bestaande filter in `Weekmenu.tsx` (`alleRecepten.find(...).filter(Boolean)`) dropt onbekende id's; opruimen op server gebeurt lui bij volgende `PUT`. |
| Twee apparaten editen tegelijk | Last-PUT-wins. Acceptabel bij kleine huishoudens en debounced writes. |
| Porties = 0 (transient tijdens typen) | Toegelaten in input; client en server filteren `porties > 0` voor verzending/opslag. |
| Hele grote porties | Geen bovengrens; berekening schaalt lineair. |

## Out of scope

- Drag-to-reorder van meals binnen een dag.
- Per-meal notities (bv. "extra spicy", "Laura allergisch voor X").
- Een echt `huishouden_id`-veld op `gebruikers`. Huidige implicatie via `SUPERADMIN_IDS` is voldoende.
- Ingredient-niveau aanpassingen op een weekmenu-meal (zoals de `aanpassingMultipliers` op de detailpagina). Daar is `porties` een eenvoudigere knop voor.
- Sync-conflict resolution beyond last-PUT-wins.
