import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useRef, useMemo, useEffect } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Heart, CalendarDays, Users, ChevronLeft, ExternalLink, Pencil, Copy } from 'lucide-react'
import type { Recept, Ingredient } from '../types'
import { NAAR_CANONICAL, STAP, formateerHoeveelheid } from '../lib/eenheden'
import type { Eenheid } from '../lib/eenheden'
import TagBadge from '../components/TagBadge'
import Afbeelding from '../components/Afbeelding'
import DagPicker from '../components/DagPicker'
import { verminderBeweging } from '../lib/motion'
import { useFavorieten } from '../store/favorieten'
import { useRecepten, maakId } from '../store/aangepaste-recepten'
import { useAuth } from '../store/auth'

gsap.registerPlugin()

function schaalMacro(waarde: number, factor: number): number {
  return Math.round(waarde * factor)
}

// Bereken de weergegeven hoeveelheid (base × factor × aanpassing)
function displayHoeveelheid(
  base: number | null,
  factor: number,
  aanpassing: number   // multiplier, standaard 1
): number | null {
  if (base === null || base === undefined) return null
  return base * factor * aanpassing
}

export default function ReceptDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { alleRecepten, voegReceptToe, laden: receptenLaden } = useRecepten()
  const [dupliceerLaden, setDupliceerLaden] = useState(false)
  const [heroMislukt, setHeroMislukt] = useState(false)
  const { gebruiker } = useAuth()
  const recept = alleRecepten.find((r: Recept) => r.id === id)
  const { isFavoriet, toggleFavoriet } = useFavorieten()
  const [personen, setPersonen] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Per-ingrediënt aanpassingsmultiplicators (1.0 = originele hoeveelheid)
  const [aanpassingMultipliers, setAanpassingMultipliers] = useState<Record<number, number>>({})
  const macrosTabelRef = useRef<HTMLTableElement>(null)

  // Bijdrage van één ingrediënt aan de totale macro's, gegeven een schaalfactor f
  // (typically aantalPersonen / recept.personen). Returnt null als ingrediënt geen
  // macros_referentie of hoeveelheid heeft.
  function ingredientBijdrage(ing: Ingredient, idx: number, f: number) {
    if (!ing.macros_referentie || ing.hoeveelheid === null || ing.hoeveelheid === undefined) return null
    const aanpassing      = aanpassingMultipliers[idx] ?? 1
    const displayed       = ing.hoeveelheid * f * aanpassing
    const canonicalAmount = displayed * (NAAR_CANONICAL[ing.eenheid as Eenheid] ?? 1)
    // macros_referentie is stored per 100g/ml or per 1 stuk
    const isWeight = ing.eenheid === 'g' || ing.eenheid === 'kg'
    const isVolume = ['ml','l','el','tl','kl','cup'].includes(ing.eenheid ?? '')
    const ref = (isWeight || isVolume) ? 100 : 1
    const m = ing.macros_referentie
    return {
      cal:   m.calorieen    * canonicalAmount / ref,
      kh:    m.koolhydraten * canonicalAmount / ref,
      eiwit: m.eiwitten     * canonicalAmount / ref,
      vet:   m.vetten       * canonicalAmount / ref,
    }
  }

  // Bereken totale macro's dynamisch via de per-ingrediënt bijdragen + scaled
  // bijdragen van sub-recepten (onderdelen).
  const berekendeTotalen = useMemo(() => {
    if (!recept) return null
    const ingrs = recept.ingredienten
    const ods   = recept.onderdelen ?? []
    const heeftBron = ingrs.some(i => i.macros_referentie) || ods.length > 0
    if (!heeftBron) return null

    const aantalP = personen ?? recept.personen
    const f       = aantalP / recept.personen
    let cal = 0, kh = 0, eiwit = 0, vet = 0

    ingrs.forEach((ing, idx) => {
      const b = ingredientBijdrage(ing, idx, f)
      if (!b) return
      cal += b.cal; kh += b.kh; eiwit += b.eiwit; vet += b.vet
    })

    // Sub-recept bijdragen: per_portie × porties × f (parent-portie schaling)
    for (const od of ods) {
      const sub = alleRecepten.find(r => r.id === od.recept_id)
      if (!sub) continue
      const pp = sub.voedingswaarden.per_portie
      const factor = od.porties * f
      cal   += pp.calorieen    * factor
      kh    += pp.koolhydraten * factor
      eiwit += pp.eiwitten     * factor
      vet   += pp.vetten       * factor
    }

    return {
      totaal: {
        calorieen: Math.round(cal), koolhydraten: Math.round(kh),
        eiwitten:  Math.round(eiwit), vetten: Math.round(vet),
      },
      per_portie: {
        calorieen: Math.round(cal / aantalP), koolhydraten: Math.round(kh / aantalP),
        eiwitten:  Math.round(eiwit / aantalP), vetten: Math.round(vet / aantalP),
      },
    }
  }, [recept, aanpassingMultipliers, personen, alleRecepten])

  // Reset de hero-afbeelding-foutstatus wanneer we naar een ander recept gaan
  useEffect(() => { setHeroMislukt(false) }, [id])

  // Flash-animatie op de macrosaarden bij elke update
  useEffect(() => {
    if (!macrosTabelRef.current || !berekendeTotalen || verminderBeweging()) return
    gsap.fromTo(
      macrosTabelRef.current.querySelectorAll('td'),
      { opacity: 0.35 },
      { opacity: 1, duration: 0.28, ease: 'power2.out', stagger: 0.015 }
    )
  }, [berekendeTotalen])

  useGSAP(() => {
    if (!containerRef.current || verminderBeweging()) return
    const els = containerRef.current.querySelectorAll<HTMLElement>('.anim-in')
    gsap.fromTo(
      els,
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, stagger: 0.11, ease: 'power3.out', clearProps: 'transform,opacity' }
    )
  }, { scope: containerRef, dependencies: [id] })

  if (!recept) {
    if (receptenLaden) {
      return (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-olive-700/15 border-t-terracotta-600 animate-spin" />
        </div>
      )
    }
    return (
      <div className="text-center py-20">
        <p className="text-olive-700/50 mb-4">Recept niet gevonden.</p>
        <Link to="/" className="text-terracotta-600 underline">Terug naar overzicht</Link>
      </div>
    )
  }

  const aantalPersonen = personen ?? recept.personen
  const factor = aantalPersonen / recept.personen
  const favoriet = isFavoriet(recept.id)
  const vw = recept.voedingswaarden
  const isEigenaar = !!gebruiker

  // Ingrediënten met hun originele index (voor aanpassingMultipliers)
  const ingredientenMetIndex = recept.ingredienten.map((ing, idx) => ({ ...ing, _idx: idx }))

  // Toon +/- controls enkel voor ingrediënten met macros_referentie én een getal
  const kanTweaken = (ing: typeof ingredientenMetIndex[number]) =>
    !!ing.macros_referentie && ing.hoeveelheid !== null && ing.hoeveelheid !== undefined

  // Pas multiplier aan zodat displayed hoeveelheid verandert met één stapgrootte
  const stapInMultiplier = (ing: typeof ingredientenMetIndex[number]) => {
    const base = ing.hoeveelheid ?? 1
    const stap = STAP[ing.eenheid as Eenheid] ?? 1
    return stap / (base * factor)   // één stap = één eenheid-stap in display
  }

  const setMultiplier = (idx: number, ing: typeof ingredientenMetIndex[number], delta: 1 | -1) => {
    const stap = stapInMultiplier(ing)
    setAanpassingMultipliers(prev => {
      const huidig = prev[idx] ?? 1
      const nieuw  = huidig + delta * stap
      const min    = stap * 0.5 // minimaal een halve stap
      return { ...prev, [idx]: Math.max(min, nieuw) }
    })
  }

  const heeftAanpassingen = Object.values(aanpassingMultipliers).some(m => m !== 1)

  // Eén ingrediëntregel — gedeeld door de gegroepeerde en de voorraad/boodschappen-weergave.
  // gedempt = lichtere stijl (voorraadkast); toonVoorraad = klein 'voorraad'-label tonen.
  function ingredientItem(ing: typeof ingredientenMetIndex[number], gedempt: boolean, toonVoorraad: boolean) {
    const displayed = displayHoeveelheid(ing.hoeveelheid, factor, aanpassingMultipliers[ing._idx] ?? 1)
    const bijdrage  = ingredientBijdrage(ing, ing._idx, factor)
    const knop = `w-7 h-7 rounded-full bg-cream border border-olive-700/15 hover:bg-olive-700/8 flex items-center justify-center ${gedempt ? 'text-olive-700/60' : 'text-olive-700'} text-xs transition-all btn-magnetic flex-shrink-0`
    const label = toonVoorraad ? <span className="text-olive-700/30"> · voorraad</span> : null
    return (
      <li key={ing._idx} className={`text-sm ${gedempt ? 'text-olive-700/50' : 'text-olive-700'}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-olive-700/20 font-light mr-1">—</span>
          {kanTweaken(ing) ? (
            <>
              <button onClick={() => setMultiplier(ing._idx, ing, -1)} aria-label="Verminder hoeveelheid" className={knop}>−</button>
              <span className={`min-w-[3.5rem] text-center tabular-nums ${gedempt ? 'text-olive-700/70' : 'font-medium'}`}>
                {formateerHoeveelheid(displayed, ing.eenheid)}
              </span>
              <button onClick={() => setMultiplier(ing._idx, ing, 1)} aria-label="Verhoog hoeveelheid" className={knop}>+</button>
              <span>{ing.naam}{label}</span>
            </>
          ) : (
            <span>{displayed !== null ? `${formateerHoeveelheid(displayed, ing.eenheid)} ` : ''}{ing.naam}{label}</span>
          )}
        </div>
        {bijdrage && (
          <span className="block ml-7 text-[10px] text-olive-700/55 tabular-nums tracking-wide">
            {Math.round(bijdrage.cal)} kcal · {Math.round(bijdrage.kh)}g KH · {Math.round(bijdrage.eiwit)}g E · {Math.round(bijdrage.vet)}g V
          </span>
        )}
      </li>
    )
  }

  // Groepeer opeenvolgende ingrediënten op `groep` (secties zoals "Burgers", "Slaw").
  const heeftGroepen = ingredientenMetIndex.some(i => (i.groep ?? '').trim() !== '')
  const ingredientGroepen: { naam: string; items: typeof ingredientenMetIndex }[] = []
  for (const ing of ingredientenMetIndex) {
    const g = (ing.groep ?? '').trim()
    const laatste = ingredientGroepen[ingredientGroepen.length - 1]
    if (laatste && laatste.naam === g) laatste.items.push(ing)
    else ingredientGroepen.push({ naam: g, items: [ing] })
  }

  // Voedingswaarden: gebruik dynamisch berekende waarden indien beschikbaar, anders opgeslagen
  const displayMacros = berekendeTotalen ?? {
    per_portie: vw.per_portie,
    totaal: {
      calorieen:    schaalMacro(vw.per_portie.calorieen,    aantalPersonen),
      koolhydraten: schaalMacro(vw.per_portie.koolhydraten, aantalPersonen),
      eiwitten:     schaalMacro(vw.per_portie.eiwitten,     aantalPersonen),
      vetten:       schaalMacro(vw.per_portie.vetten,       aantalPersonen),
    },
  }

  async function handleDupliceer() {
    if (!recept || dupliceerLaden) return
    setDupliceerLaden(true)
    try {
      const nieuweTitel = `${recept.titel} (kopie)`
      const kopie: Recept = {
        ...recept,
        id: maakId(nieuweTitel),
        titel: nieuweTitel,
        datum: new Date().toISOString().slice(0, 10),
      }
      const nieuw = await voegReceptToe(kopie)
      navigate(`/recept/${nieuw.id}/bewerken`)
    } catch (err) {
      console.error('Dupliceren mislukt', err)
      setDupliceerLaden(false)
    }
  }

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto">
      <div className="anim-in flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-olive-700/50 hover:text-olive-700 flex items-center gap-1 transition-colors btn-magnetic"
        >
          <ChevronLeft size={16} /> Terug
        </button>
        {isEigenaar && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDupliceer}
              disabled={dupliceerLaden}
              className="btn btn-outline btn-sm"
              title="Maak een kopie en open hem in de bewerker"
            >
              <Copy size={12} aria-hidden="true" /> {dupliceerLaden ? 'Bezig…' : 'Kopiëren'}
            </button>
            <Link to={`/recept/${recept.id}/bewerken`} className="btn btn-outline btn-sm">
              <Pencil size={12} aria-hidden="true" /> Bewerken
            </Link>
          </div>
        )}
      </div>

      {/* Hero card — geen overflow-hidden zodat de dag-picker niet geclipped wordt */}
      <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card mb-4">
        {recept.afbeelding_url && !heroMislukt ? (
          <div className="relative overflow-hidden h-64 rounded-t-4xl">
            <img
              src={recept.afbeelding_url}
              alt={recept.titel}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setHeroMislukt(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-olive-900/40 to-transparent" />
          </div>
        ) : (
          <div className="w-full h-64 bg-olive-50 flex items-center justify-center text-olive-200 text-6xl rounded-t-4xl" aria-hidden="true">
            🍽
          </div>
        )}
        <div className="p-7">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="font-serif text-2xl font-bold text-olive-700 leading-tight">{recept.titel}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Favoriet */}
              <button
                onClick={() => toggleFavoriet(recept.id)}
                className="w-9 h-9 rounded-full border border-olive-700/15 hover:border-terracotta-300 flex items-center justify-center transition-all btn-magnetic"
                title={favoriet ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
                aria-label={favoriet ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
                aria-pressed={favoriet}
              >
                <Heart
                  size={16}
                  aria-hidden="true"
                  className={favoriet ? 'text-terracotta-600 fill-terracotta-600' : 'text-olive-700/30'}
                />
              </button>

              {/* Weekmenu picker */}
              <DagPicker
                recept={recept}
                richting="onder"
                align="rechts"
                renderTrigger={({ open, toggle, actieveDagen }) => (
                  <button
                    onClick={toggle}
                    aria-expanded={open}
                    aria-label="Voeg toe aan weekmenu"
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full transition-all btn-magnetic border ${
                      actieveDagen.length > 0
                        ? 'bg-olive-700 text-cream border-olive-700'
                        : 'bg-cream border-olive-700/15 text-olive-700 hover:bg-olive-700/8'
                    }`}
                  >
                    <CalendarDays size={14} aria-hidden="true" />
                    {actieveDagen.length > 0 ? actieveDagen.map(d => d.slice(0, 2)).join(', ') : 'Voeg toe'}
                  </button>
                )}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-5">
            {recept.tags.filter(t => t !== 'recept').map(tag => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>

          <div className="flex items-center gap-4 text-sm text-olive-700/60 flex-wrap">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-olive-700/40" />
              <button
                onClick={() => setPersonen(Math.max(1, aantalPersonen - 1))}
                aria-label="Minder personen"
                className="w-8 h-8 rounded-full bg-cream border border-olive-700/10 hover:bg-olive-700/8 flex items-center justify-center font-bold text-olive-700 text-sm transition-all btn-magnetic"
              >−</button>
              <span className="font-semibold text-olive-700 min-w-[1.5rem] text-center tabular-nums">{aantalPersonen}</span>
              <button
                onClick={() => setPersonen(aantalPersonen + 1)}
                aria-label="Meer personen"
                className="w-8 h-8 rounded-full bg-cream border border-olive-700/10 hover:bg-olive-700/8 flex items-center justify-center font-bold text-olive-700 text-sm transition-all btn-magnetic"
              >+</button>
              <span>personen</span>
              {personen !== null && (
                <button onClick={() => setPersonen(null)} className="text-xs text-olive-700/30 hover:text-olive-700/60 underline underline-offset-2 transition-colors">
                  reset
                </button>
              )}
            </div>
            {recept.bron_url && (
              <a href={recept.bron_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-terracotta-600 hover:underline text-xs font-medium ml-auto transition-colors">
                Bron <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Ingrediënten */}
      <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card p-7 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest">Ingrediënten</h2>
          {heeftAanpassingen && (
            <button
              onClick={() => setAanpassingMultipliers({})}
              className="text-xs text-olive-700/40 hover:text-terracotta-600 underline underline-offset-2 transition-colors"
            >
              reset aanpassingen
            </button>
          )}
        </div>
        {heeftGroepen ? (
          /* Recept met secties (bijv. Burgers / Slaw / Saus) */
          <div className="space-y-1">
            {ingredientGroepen.map((groep, gi) => (
              <div key={gi}>
                {groep.naam && (
                  <p className="text-xs font-bold uppercase tracking-widest text-terracotta-700 mb-2 mt-5 first:mt-0">{groep.naam}</p>
                )}
                <ul className="space-y-1.5">
                  {groep.items.map(ing => ingredientItem(ing, ing.voorraadkast, ing.voorraadkast))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          /* Geen secties: splitsen in voorraadkast en boodschappen */
          <>
            {ingredientenMetIndex.some(i => i.voorraadkast) && (
              <>
                <p className="text-[10px] text-olive-700/40 uppercase tracking-widest mb-2 font-semibold">Voorraadkast</p>
                <ul className="mb-4 space-y-1.5">
                  {ingredientenMetIndex.filter(i => i.voorraadkast).map(ing => ingredientItem(ing, true, false))}
                </ul>
              </>
            )}
            <p className="text-[10px] text-olive-700/40 uppercase tracking-widest mb-2 font-semibold">Boodschappen</p>
            <ul className="space-y-1.5">
              {ingredientenMetIndex.filter(i => !i.voorraadkast).map(ing => ingredientItem(ing, false, false))}
            </ul>
          </>
        )}
      </div>

      {/* Onderdelen */}
      {recept.onderdelen && recept.onderdelen.length > 0 && (
        <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card p-7 mb-4">
          <h2 className="font-semibold text-olive-700 mb-4 text-sm uppercase tracking-widest">Onderdelen</h2>
          <ul className="space-y-2.5">
            {recept.onderdelen.map((od, idx) => {
              const sub = alleRecepten.find(r => r.id === od.recept_id)
              const geschaaldePorties = od.porties * factor
              if (!sub) {
                return (
                  <li key={idx} className="flex items-center gap-3 text-sm text-olive-700/35 italic">
                    <span className="w-9 h-9 rounded-xl bg-olive-700/5 flex-shrink-0" />
                    <span>Onbekend onderdeel — verwijderd</span>
                  </li>
                )
              }
              return (
                <li key={idx}>
                  <Link to={`/recept/${sub.id}`}
                    className="flex items-center gap-3 text-sm text-olive-700 hover:bg-cream rounded-2xl -mx-2 px-2 py-1.5 transition-colors group">
                    <Afbeelding src={sub.afbeelding_url} alt="" className="w-9 h-9 rounded-xl flex-shrink-0" imgClassName="object-cover" fallbackClassName="text-sm" />
                    <span className="flex-1 font-medium group-hover:text-terracotta-600 transition-colors">{sub.titel}</span>
                    <span className="text-olive-700/50 tabular-nums text-sm">
                      {geschaaldePorties % 1 === 0 ? geschaaldePorties : geschaaldePorties.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} {geschaaldePorties === 1 ? 'portie' : 'porties'}
                    </span>
                    <ExternalLink size={14} className="text-olive-700/30 group-hover:text-terracotta-600 transition-colors" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Bereiding */}
      <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card p-7 mb-4">
        <h2 className="font-semibold text-olive-700 mb-4 text-sm uppercase tracking-widest">Bereiding</h2>
        <ol className="space-y-4">
          {recept.bereiding.map((stap, idx) => (
            <li key={idx} className="flex gap-4 text-sm text-olive-700/80">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-terracotta-600/10 text-terracotta-600 text-xs font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <span className="leading-relaxed">{stap}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Voedingswaarden */}
      <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card p-7">
        <h2 className="font-semibold text-olive-700 mb-1 text-sm uppercase tracking-widest">Voedingswaarden</h2>
        {berekendeTotalen ? (
          <p className="text-[11px] text-olive-700/40 mb-4">
            {heeftAanpassingen ? 'Aangepaste hoeveelheden' : 'Berekend op basis van ingrediënten'}
          </p>
        ) : vw.schatting ? (
          <p className="text-[11px] text-olive-700/40 mb-4">Schatting op basis van ingrediënten</p>
        ) : null}
        <table ref={macrosTabelRef} className="w-full text-sm mt-3">
          <thead>
            <tr className="text-[10px] text-olive-700/40 uppercase tracking-widest border-b border-olive-700/6">
              <th className="text-left py-2 font-semibold">Macro</th>
              <th className="text-right py-2 font-semibold">Per portie</th>
              <th className="text-right py-2 font-semibold">Totaal ({aantalPersonen} pers.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive-700/4">
            {[
              { label: 'Calorieën', key: 'calorieen' as const, unit: 'kcal' },
              { label: 'Koolhydraten', key: 'koolhydraten' as const, unit: 'g' },
              { label: 'Eiwitten', key: 'eiwitten' as const, unit: 'g' },
              { label: 'Vetten', key: 'vetten' as const, unit: 'g' },
            ].map(row => (
              <tr key={row.key}>
                <td className="py-2.5 text-olive-700/70 font-medium">{row.label}</td>
                <td className="py-2.5 text-right text-olive-700 font-semibold tabular-nums">
                  {!berekendeTotalen && vw.schatting ? '± ' : ''}
                  {displayMacros.per_portie[row.key]}
                  <span className="text-olive-700/40 font-normal text-xs ml-0.5">{row.unit}</span>
                </td>
                <td className="py-2.5 text-right text-olive-700/50 tabular-nums">
                  {!berekendeTotalen && vw.schatting ? '± ' : ''}
                  {displayMacros.totaal[row.key]}
                  <span className="text-olive-700/30 text-xs ml-0.5">{row.unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
