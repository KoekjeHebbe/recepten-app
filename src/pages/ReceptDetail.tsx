import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useRef, useMemo, useEffect } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Heart, CalendarDays, Users, ChevronLeft, ExternalLink, Pencil, Check, X } from 'lucide-react'
import type { Recept, Dag, Ingredient } from '../types'
import { NAAR_CANONICAL, STAP, formateerHoeveelheid } from '../lib/eenheden'
import type { Eenheid } from '../lib/eenheden'
import { DAGEN } from '../types'
import TagBadge from '../components/TagBadge'
import { useWeekMenu } from '../store/weekmenu'
import { useFavorieten } from '../store/favorieten'
import { useRecepten } from '../store/aangepaste-recepten'
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
  const { alleRecepten } = useRecepten()
  const { gebruiker } = useAuth()
  const recept = alleRecepten.find((r: Recept) => r.id === id)
  const { menu, addToDay, removeFromDay } = useWeekMenu()
  const { isFavoriet, toggleFavoriet } = useFavorieten()
  const [dagPickerOpen, setDagPickerOpen] = useState(false)
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

  // Bereken totale macro's dynamisch via de per-ingrediënt bijdragen.
  const berekendeTotalen = useMemo(() => {
    if (!recept) return null
    const ingrs = recept.ingredienten
    if (!ingrs.some(i => i.macros_referentie)) return null

    const aantalP = personen ?? recept.personen
    const f       = aantalP / recept.personen
    let cal = 0, kh = 0, eiwit = 0, vet = 0

    ingrs.forEach((ing, idx) => {
      const b = ingredientBijdrage(ing, idx, f)
      if (!b) return
      cal += b.cal; kh += b.kh; eiwit += b.eiwit; vet += b.vet
    })

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
  }, [recept, aanpassingMultipliers, personen])

  // Flash-animatie op de macrosaarden bij elke update
  useEffect(() => {
    if (!macrosTabelRef.current || !berekendeTotalen) return
    gsap.fromTo(
      macrosTabelRef.current.querySelectorAll('td'),
      { opacity: 0.35 },
      { opacity: 1, duration: 0.28, ease: 'power2.out', stagger: 0.015 }
    )
  }, [berekendeTotalen])

  useGSAP(() => {
    if (!containerRef.current) return
    const els = containerRef.current.querySelectorAll<HTMLElement>('.anim-in')
    gsap.fromTo(
      els,
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, stagger: 0.11, ease: 'power3.out', clearProps: 'transform,opacity' }
    )
  }, { scope: containerRef, dependencies: [id] })

  if (!recept) {
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
  const dagenMetRecept = DAGEN.filter(dag => menu[dag].includes(recept.id))
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

  function handleToggleDay(dag: Dag) {
    if (menu[dag].includes(recept!.id)) {
      removeFromDay(dag, recept!.id)
    } else {
      addToDay(dag, recept!.id)
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
          <Link
            to={`/recept/${recept.id}/bewerken`}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-olive-700/15 text-olive-700/50 hover:text-olive-700 hover:border-olive-700/30 transition-all btn-magnetic"
          >
            <Pencil size={12} /> Bewerken
          </Link>
        )}
      </div>

      {/* Hero card — geen overflow-hidden zodat de dag-picker niet geclipped wordt */}
      <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card mb-4">
        {recept.afbeelding_url ? (
          <div className="relative overflow-hidden h-64 rounded-t-4xl">
            <img
              src={recept.afbeelding_url}
              alt={recept.titel}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-olive-900/40 to-transparent" />
          </div>
        ) : (
          <div className="w-full h-36 bg-olive-50 flex items-center justify-center text-olive-200 text-6xl rounded-t-4xl">
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
              >
                <Heart
                  size={16}
                  className={favoriet ? 'text-terracotta-600 fill-terracotta-600' : 'text-olive-700/30'}
                />
              </button>

              {/* Weekmenu picker */}
              <div className="relative">
                <button
                  onClick={() => setDagPickerOpen(p => !p)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full transition-all btn-magnetic border ${
                    dagenMetRecept.length > 0
                      ? 'bg-olive-700 text-cream border-olive-700'
                      : 'bg-cream border-olive-700/15 text-olive-700 hover:bg-olive-700/8'
                  }`}
                >
                  <CalendarDays size={13} />
                  {dagenMetRecept.length > 0 ? dagenMetRecept.map(d => d.slice(0, 2)).join(', ') : 'Voeg toe'}
                </button>
                {dagPickerOpen && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-3xl shadow-card-hover border border-olive-700/8 z-50 min-w-[168px] py-2">
                    {DAGEN.map(dag => (
                      <button
                        key={dag}
                        onClick={() => handleToggleDay(dag)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cream transition-colors flex items-center justify-between ${
                          menu[dag].includes(recept.id) ? 'text-olive-700 font-semibold' : 'text-olive-700/70'
                        }`}
                      >
                        <span className="capitalize">{dag}</span>
                        {menu[dag].includes(recept.id) && <Check size={12} className="text-terracotta-600" />}
                      </button>
                    ))}
                    <div className="border-t border-olive-700/6 mt-1 pt-1">
                      <button
                        onClick={() => setDagPickerOpen(false)}
                        className="w-full text-left px-4 py-2 text-xs text-olive-700/40 hover:bg-cream transition-colors flex items-center gap-1.5"
                      >
                        <X size={10} /> Sluiten
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-5">
            {recept.tags.filter(t => t !== 'recept').map(tag => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>

          <div className="flex items-center gap-4 text-sm text-olive-700/60 flex-wrap">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-olive-700/40" />
              <button
                onClick={() => setPersonen(Math.max(1, aantalPersonen - 1))}
                className="w-6 h-6 rounded-full bg-cream border border-olive-700/10 hover:bg-olive-700/8 flex items-center justify-center font-bold text-olive-700 text-sm transition-all btn-magnetic"
              >−</button>
              <span className="font-semibold text-olive-700 min-w-[1.5rem] text-center tabular-nums">{aantalPersonen}</span>
              <button
                onClick={() => setPersonen(aantalPersonen + 1)}
                className="w-6 h-6 rounded-full bg-cream border border-olive-700/10 hover:bg-olive-700/8 flex items-center justify-center font-bold text-olive-700 text-sm transition-all btn-magnetic"
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
                Bron <ExternalLink size={11} />
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
        {ingredientenMetIndex.some(i => i.voorraadkast) && (
          <>
            <p className="text-[10px] text-olive-700/40 uppercase tracking-widest mb-2 font-semibold">Voorraadkast</p>
            <ul className="mb-4 space-y-1.5">
              {ingredientenMetIndex.filter(i => i.voorraadkast).map(ing => {
                const displayed = displayHoeveelheid(ing.hoeveelheid, factor, aanpassingMultipliers[ing._idx] ?? 1)
                const bijdrage  = ingredientBijdrage(ing, ing._idx, factor)
                return (
                  <li key={ing._idx} className="text-sm text-olive-700/50">
                    <div className="flex items-center gap-1.5">
                      <span className="text-olive-700/20 font-light mr-1">—</span>
                      {kanTweaken(ing) ? (
                        <>
                          <button onClick={() => setMultiplier(ing._idx, ing, -1)}
                            className="w-5 h-5 rounded-full bg-cream border border-olive-700/15 hover:bg-olive-700/8 flex items-center justify-center text-olive-700/60 text-xs transition-all btn-magnetic flex-shrink-0">−</button>
                          <span className="min-w-[3.5rem] text-center tabular-nums text-olive-700/70">
                            {formateerHoeveelheid(displayed, ing.eenheid)}
                          </span>
                          <button onClick={() => setMultiplier(ing._idx, ing, 1)}
                            className="w-5 h-5 rounded-full bg-cream border border-olive-700/15 hover:bg-olive-700/8 flex items-center justify-center text-olive-700/60 text-xs transition-all btn-magnetic flex-shrink-0">+</button>
                          <span>{ing.naam}</span>
                        </>
                      ) : (
                        <span>{displayed !== null ? `${formateerHoeveelheid(displayed, ing.eenheid)} ` : ''}{ing.naam}</span>
                      )}
                    </div>
                    {bijdrage && (
                      <span className="block ml-7 text-[10px] text-olive-700/35 tabular-nums tracking-wide">
                        {Math.round(bijdrage.cal)} kcal · {Math.round(bijdrage.kh)}g KH · {Math.round(bijdrage.eiwit)}g E · {Math.round(bijdrage.vet)}g V
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <p className="text-[10px] text-olive-700/40 uppercase tracking-widest mb-2 font-semibold">Boodschappen</p>
        <ul className="space-y-1.5">
          {ingredientenMetIndex.filter(i => !i.voorraadkast).map(ing => {
            const displayed = displayHoeveelheid(ing.hoeveelheid, factor, aanpassingMultipliers[ing._idx] ?? 1)
            const bijdrage  = ingredientBijdrage(ing, ing._idx, factor)
            return (
              <li key={ing._idx} className="text-sm text-olive-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-olive-700/20 font-light mr-1">—</span>
                  {kanTweaken(ing) ? (
                    <>
                      <button onClick={() => setMultiplier(ing._idx, ing, -1)}
                        className="w-5 h-5 rounded-full bg-cream border border-olive-700/15 hover:bg-olive-700/8 flex items-center justify-center text-olive-700 text-xs transition-all btn-magnetic flex-shrink-0">−</button>
                      <span className="min-w-[3.5rem] text-center tabular-nums font-medium">
                        {formateerHoeveelheid(displayed, ing.eenheid)}
                      </span>
                      <button onClick={() => setMultiplier(ing._idx, ing, 1)}
                        className="w-5 h-5 rounded-full bg-cream border border-olive-700/15 hover:bg-olive-700/8 flex items-center justify-center text-olive-700 text-xs transition-all btn-magnetic flex-shrink-0">+</button>
                      <span>{ing.naam}</span>
                    </>
                  ) : (
                    <span>{displayed !== null ? `${formateerHoeveelheid(displayed, ing.eenheid)} ` : ''}{ing.naam}</span>
                  )}
                </div>
                {bijdrage && (
                  <span className="block ml-7 text-[10px] text-olive-700/40 tabular-nums tracking-wide">
                    {Math.round(bijdrage.cal)} kcal · {Math.round(bijdrage.kh)}g KH · {Math.round(bijdrage.eiwit)}g E · {Math.round(bijdrage.vet)}g V
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

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
