# Sub-recepten als onderdelen — design

**Datum:** 2026-04-25
**Status:** Approved (brainstorming → ready for implementation plan)

## Probleem

Sommige recepten gebruiken andere recepten als bouwsteen — bijvoorbeeld "keto hamburger buns" als onderdeel van een burger-recept. Vandaag moet je elk ingrediënt van de buns handmatig overtikken in het burger-recept, met dubbele administratie en kans op fouten in de macro-berekening.

We willen één recept naar een ander kunnen verwijzen zodat:

1. De macro's van het sub-recept automatisch meetellen in het bovenliggende recept.
2. De ingrediënten van het sub-recept op de boodschappenlijst verschijnen wanneer het bovenliggende recept in het weekmenu staat.
3. De ingrediënten van het sub-recept **niet** in de ingrediëntenlijst van het bovenliggende recept terechtkomen — die blijft schoon.

## Beslissingen

| # | Vraag | Keuze |
|---|---|---|
| Q1 | Hoe geef je "hoeveel" van een sub-recept aan? | **Porties van het sub-recept** (bv. `0,5` = halve portie van een 4-personen recept = 12,5% van de ingrediënten). Hergebruikt `personen`-veld; geen nieuw schema. |
| Q2 | Waar in de editor? | **Aparte sectie "Onderdelen"** onder de Ingrediënten-sectie. Geen gemengde rij in de ingrediëntenlijst. |
| Q3 | Mag een sub-recept zelf onderdelen hebben? | **Nee — single level only.** Geen recursie, geen cycle detection nodig. |
| Q4 | Hoe blijven macro's correct? | **Live computatie in de frontend.** `berekendeTotalen` rekent dynamisch met de actuele sub-recept macro's. Backend slaat snapshot op bij save voor lijstweergaves. |

## Datamodel

Nieuw type, nieuw optioneel veld op `Recept`:

```ts
// src/types/index.ts
export interface Onderdeel {
  recept_id: string   // foreign key naar een ander recept
  porties: number     // aantal porties van dat recept (decimalen toegestaan)
}

export interface Recept {
  // ...bestaande velden...
  onderdelen?: Onderdeel[]
}
```

Opgeslagen in de bestaande JSON-kolom `recepten.recepten`. Geen DB-migratie. Bestaande recepten zonder `onderdelen` blijven werken (optionele property).

## Backend (`api/recepten.php`)

### `normaliseerRecept()` uitbreiden

Naast bestaande ingrediënt-normalisatie ook `onderdelen` valideren:

1. Coerce naar array; elk item `{recept_id: string, porties: float}`.
2. Drop entries met ontbrekende/ongeldige velden.
3. Drop entries waarvan `recept_id` niet in de `recepten`-tabel bestaat (één lookup batchen per save).
4. Drop entries waarvan het target-recept zelf niet-lege `onderdelen` heeft (single-level guard).
5. Drop entries met `recept_id === eigen_id` (zelfreferentie).

### `herbereken_voedingswaarden()` uitbreiden

Na het sommeren van eigen ingrediënten:

```
voor elke onderdeel od:
  sub = lookup(od.recept_id)
  per_portie_totaal += sub.voedingswaarden.per_portie * od.porties
```

Daarna delen door `personen` voor `per_portie` van het ouder-recept (zelfde als vandaag).

### `schatting`-flag propageren

Als minstens één van de gerefereerde sub-recepten `voedingswaarden.schatting === true` heeft, wordt de `schatting` van het bovenliggende recept op `true` gezet bij save (gedeeltelijk afgeleide macro's = onzeker).

### Géén cascade

Wanneer een sub-recept wordt bewerkt, worden ouder-recepten **niet** automatisch herrekend. De frontend toont altijd de live waarde; lijstweergaves werken op de snapshot tot het ouder-recept opnieuw wordt opgeslagen. Dezelfde staleness-tolerantie als de bestaande `schatting: true` flow.

## Editor — `ReceptToevoegen.tsx`

Nieuwe sectie **onder** de Ingrediënten-sectie, boven de Bereiding-sectie:

```tsx
const [onderdelen, setOnderdelen] = useState<Onderdeel[]>([])
// gevuld vanuit bestaandRecept.onderdelen ?? []

<section>
  <h2>Onderdelen</h2>
  <p>Andere recepten die in dit gerecht gebruikt worden. Hun ingrediënten
     verschijnen automatisch op de boodschappenlijst, hun macro's tellen mee.</p>
  {onderdelen.map((od, idx) => (
    <ReceptKiezer
      value={od.recept_id}
      excludeIds={[id, ...recipesMetOnderdelen]}
      onChange={...}
    />
    <input type="number" min={0} step={arrowStap(od.porties)}
           value={od.porties} onChange={...} />
    <span>porties</span>
    <button onClick={removeOnderdeel(idx)}>×</button>
  ))}
  <button onClick={addOnderdeel}>+ Onderdeel toevoegen</button>
</section>
```

**Validatie in `opslaan()`**: filter onderdelen met lege `recept_id` of `porties <= 0`. Geen modal/alert; stil weglaten zoals de bestaande ingrediënt-filter.

**Hergebruik `arrowStap`**: het porties-input-veld krijgt dezelfde 0,5 / 1 / 5 stap-logica als de ingrediënt-hoeveelheden.

## Nieuwe component — `src/components/ReceptKiezer.tsx`

Combobox / autocomplete voor recept-selectie:

- Tekstveld dat `useRecepten().alleRecepten` filtert op `titel` (case-insensitive, includes-match).
- Dropdown toont max 10 matches met thumbnail (`afbeelding_url`) + titel.
- Filtert IDs uit `excludeIds` weg (huidig recept + alle recepten die zelf `onderdelen` hebben).
- Bij selectie: stuurt `recept_id` via `onChange`; toont titel als pill zodat duidelijk is welk recept gekozen is.
- Inline hint onderaan dropdown: "*N recepten met eigen onderdelen verborgen*" als die filter werkelijk iets verbergt.

## Detail page — `ReceptDetail.tsx`

### Nieuwe "Onderdelen" sectie

Onder de ingrediëntenlijst, boven de bereiding:

```
[thumb] Keto hamburger buns — 0,5 porties → (link naar /recept/<id>)
[thumb] Tomatensaus            — 2 porties  → (link)
```

Sectie verbergt zich als `onderdelen` leeg/ontbreekt.

### Live macro-berekening

`berekendeTotalen` useMemo uitbreiden:

```ts
const berekendeTotalen = useMemo(() => {
  let totaal = sommeerEigenIngredienten(recept.ingredienten)
  for (const od of recept.onderdelen ?? []) {
    const sub = alleRecepten.find(r => r.id === od.recept_id)
    if (!sub) continue
    const per_portie = sub.voedingswaarden.per_portie
    totaal.calorieen   += per_portie.calorieen   * od.porties
    totaal.koolhydraten += per_portie.koolhydraten * od.porties
    totaal.eiwitten    += per_portie.eiwitten    * od.porties
    totaal.vetten      += per_portie.vetten      * od.porties
  }
  return totaal
}, [recept, alleRecepten])
```

Bestaande deling door `personen` voor de weergave per portie blijft ongewijzigd.

### Verwijderd / ontbrekend sub-recept

Als `alleRecepten.find(...)` `undefined` teruggeeft: render een grijze regel "Onbekend onderdeel — verwijderd", geen link, geen macro-bijdrage. Pagina blijft werken.

### Portie-scaler

Bestaande scaler vermenigvuldigt ingrediënt-`hoeveelheid` met `gekozenPersonen / recept.personen`. Onderdelen-`porties` worden met dezelfde factor geschaald — lineaire scaling, geen speciaal geval.

### +/- per ingrediënt

Niet van toepassing op onderdelen. Onderdelen-rijen tonen `porties` als statisch label.

## Boodschappenlijst — `Boodschappen.tsx`

`groepeerIngredienten()` uitbreiden zodat hij ook de `onderdelen` van elk weekmenu-recept verwerkt:

```ts
function voegToe(map, ing, factor) {
  // bestaand inner-block, maar hoeveelheid * factor
}

for (const recept of geselecteerd) {
  // eigen ingrediënten (ongewijzigd)
  for (const ing of recept.ingredienten) voegToe(map, ing, 1)

  // onderdelen — uitbreiden naar sub-recept ingrediënten, geschaald
  for (const od of recept.onderdelen ?? []) {
    const sub = alleRecepten.find(r => r.id === od.recept_id)
    if (!sub || !sub.personen) continue
    const factor = od.porties / sub.personen
    for (const ing of sub.ingredienten) voegToe(map, ing, factor)
  }
}
```

### Gedrag

- **Categorie & voorraadkast** komen van het sub-recept zelf (de buns weten dat hun bloem voorraadkast is).
- **Hoeveelheden blijven concatenerend**: "300 g + 50 g bloem" — geen automatische sommatie van mogelijk verschillende eenheden. Conform bestaand gedrag.
- **`betrokkenRecepten`** badge bovenin toont alleen weekmenu-recepten, niet de onderliggende sub-recepten.
- **Ontbrekend sub-recept**: stil overslaan (`if (!sub) continue`).

### Weekmenu page

`Weekmenu.tsx` toont kcal per dag op basis van `recept.voedingswaarden.per_portie.calorieen`. Omdat de backend de geschaalde sub-macro's al meeneemt in de opgeslagen snapshot (zie *Backend → herbereken*), blijft Weekmenu correct zonder code-wijzigingen — mits het ouder-recept minstens één keer is opgeslagen sinds onderdelen werden toegevoegd.

## Bestanden die wijzigen

| Bestand | Wijziging |
|---|---|
| `src/types/index.ts` | `Onderdeel` interface + `Recept.onderdelen?` veld |
| `src/components/ReceptKiezer.tsx` | **Nieuw** — combobox component |
| `src/pages/ReceptToevoegen.tsx` | "Onderdelen" sectie onder ingrediënten + state + opslaan() filtering |
| `src/pages/ReceptDetail.tsx` | "Onderdelen" rendersectie + uitgebreide `berekendeTotalen` |
| `src/pages/Boodschappen.tsx` | `voegToe` extractie + onderdelen-expansie in `groepeerIngredienten` |
| `api/recepten.php` | Validatie/normalisatie van `onderdelen`, sub-macro's in `herbereken_voedingswaarden`, `schatting` propagatie |

Geen wijzigingen aan: `Home.tsx`, `Weekmenu.tsx`, `ReceptKaart.tsx`, `Nav.tsx`, andere stores. Geen DB-migratie. Geen nieuwe routes.

## Bewust niet doen (out of scope)

- **Cascading recompute** van ouder-macro's bij wijziging van een sub-recept. Frontend live-rekent; lijst-staleness is acceptabel (zelfde tolerantie als de bestaande `schatting`-flow).
- **Geneste onderdelen** (sub-sub-recepten). Single-level, per Q3.
- **Yield-veld** op recepten (bv. "8 stuks buns"). `personen` is de eenheid, per Q1.
- **Onderdelen-badges** op `Home.tsx` recept-kaarten. Lijstweergaves blijven hun stored snapshot tonen.

## Edge cases samengevat

| Scenario | Gedrag |
|---|---|
| Sub-recept wordt verwijderd | Grijze rij "Onbekend onderdeel" op detailpagina, niets in boodschappen, geen macro-bijdrage. Geen crash. |
| Sub-recept wordt bewerkt | Detailpagina van ouder toont live nieuwe macro's. Lijst-/Weekmenuweergaves tonen stale waarden tot ouder opnieuw saved wordt. |
| Cycle (A → B → A) | Onmogelijk te creëren: ReceptKiezer filtert recepten met onderdelen weg. Backend valideert hetzelfde bij save. |
| Zelfreferentie (A → A) | Onmogelijk: ReceptKiezer filtert het huidige recept-ID weg. Backend valideert. |
| `porties = 0` of negatief | Editor strippt zulke entries bij save. Frontend live-rekening behandelt 0 als 0-bijdrage (geen crash). |
| Sub-recept zonder macro's | Bijdrage = 0 op alle macro's; `schatting`-propagatie kijkt naar de flag, niet de waarden. |
