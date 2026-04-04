import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { Recept, Dag } from '../types'
import { DAGEN } from '../types'
import TagBadge from '../components/TagBadge'
import { useWeekMenu } from '../store/weekmenu'
import { useFavorieten } from '../store/favorieten'
import { useRecepten } from '../store/aangepaste-recepten'

gsap.registerPlugin()

function schaalHoeveelheid(hoeveelheid: string | null, factor: number): string | null {
  if (!hoeveelheid || factor === 1) return hoeveelheid
  const match = hoeveelheid.match(/^(\d+(?:[.,]\d+)?)([\s\S]*)$/)
  if (!match) return hoeveelheid
  const getal = parseFloat(match[1].replace(',', '.'))
  const rest = match[2]
  const geschaald = Math.round(getal * factor * 10) / 10
  const geformatteerd = Number.isInteger(geschaald)
    ? String(geschaald)
    : geschaald.toFixed(1).replace('.', ',')
  return `${geformatteerd}${rest}`
}

function schaalMacro(waarde: number, factor: number): number {
  return Math.round(waarde * factor)
}

export default function ReceptDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { alleRecepten } = useRecepten()
  const recept = alleRecepten.find((r: Recept) => r.id === id)
  const { menu, addToDay, removeFromDay } = useWeekMenu()
  const { isFavoriet, toggleFavoriet } = useFavorieten()
  const [dagPickerOpen, setDagPickerOpen] = useState(false)
  const [personen, setPersonen] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  function handleToggleDay(dag: Dag) {
    if (menu[dag].includes(recept!.id)) {
      removeFromDay(dag, recept!.id)
    } else {
      addToDay(dag, recept!.id)
    }
  }

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="anim-in text-sm text-olive-700/50 hover:text-olive-700 mb-5 flex items-center gap-1.5 transition-colors btn-magnetic"
      >
        ← Terug
      </button>

      {/* Hero card */}
      <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card overflow-hidden mb-4">
        {recept.afbeelding_url ? (
          <div className="relative overflow-hidden h-64">
            <img
              src={recept.afbeelding_url}
              alt={recept.titel}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-olive-900/40 to-transparent" />
          </div>
        ) : (
          <div className="w-full h-36 bg-olive-50 flex items-center justify-center text-olive-200 text-6xl">
            🍽
          </div>
        )}
        <div className="p-7">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="font-serif text-2xl font-bold text-olive-700 leading-tight">{recept.titel}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => toggleFavoriet(recept.id)}
                className="text-xl btn-magnetic"
                title={favoriet ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
              >
                {favoriet ? '❤️' : '🤍'}
              </button>
              <div className="relative">
                <button
                  onClick={() => setDagPickerOpen(p => !p)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all btn-magnetic border ${
                    dagenMetRecept.length > 0
                      ? 'bg-olive-700 text-cream border-olive-700'
                      : 'bg-cream border-olive-700/15 text-olive-700 hover:bg-olive-700/8'
                  }`}
                >
                  📅 {dagenMetRecept.length > 0 ? dagenMetRecept.map(d => d.slice(0, 2)).join(', ') : 'Voeg toe'}
                </button>
                {dagPickerOpen && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-3xl shadow-card-hover border border-olive-700/8 z-10 min-w-[168px] py-2 overflow-hidden">
                    {DAGEN.map(dag => (
                      <button
                        key={dag}
                        onClick={() => handleToggleDay(dag)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cream transition-colors flex items-center justify-between ${
                          menu[dag].includes(recept.id) ? 'text-olive-700 font-semibold' : 'text-olive-700/70'
                        }`}
                      >
                        <span className="capitalize">{dag}</span>
                        {menu[dag].includes(recept.id) && <span className="text-terracotta-600 text-xs">✓</span>}
                      </button>
                    ))}
                    <div className="border-t border-olive-700/6 mt-1 pt-1">
                      <button
                        onClick={() => setDagPickerOpen(false)}
                        className="w-full text-left px-4 py-2 text-xs text-olive-700/40 hover:bg-cream transition-colors"
                      >
                        Sluiten
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
              <span className="text-base">👥</span>
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
                className="text-terracotta-600 hover:underline text-xs font-medium ml-auto transition-colors">
                Bron ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Ingrediënten */}
      <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card p-7 mb-4">
        <h2 className="font-semibold text-olive-700 mb-4 text-sm uppercase tracking-widest">Ingrediënten</h2>
        {recept.ingredienten.some(i => i.voorraadkast) && (
          <>
            <p className="text-[10px] text-olive-700/40 uppercase tracking-widest mb-2 font-semibold">Voorraadkast</p>
            <ul className="mb-4 space-y-1.5">
              {recept.ingredienten.filter(i => i.voorraadkast).map((ing, idx) => (
                <li key={idx} className="text-sm text-olive-700/50 flex gap-2.5">
                  <span className="text-olive-700/20 font-light">—</span>
                  <span>{schaalHoeveelheid(ing.hoeveelheid, factor) ? `${schaalHoeveelheid(ing.hoeveelheid, factor)} ` : ''}{ing.naam}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-[10px] text-olive-700/40 uppercase tracking-widest mb-2 font-semibold">Boodschappen</p>
        <ul className="space-y-1.5">
          {recept.ingredienten.filter(i => !i.voorraadkast).map((ing, idx) => (
            <li key={idx} className="text-sm text-olive-700 flex gap-2.5">
              <span className="text-olive-700/20 font-light">—</span>
              <span>{schaalHoeveelheid(ing.hoeveelheid, factor) ? `${schaalHoeveelheid(ing.hoeveelheid, factor)} ` : ''}{ing.naam}</span>
            </li>
          ))}
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
        {vw.schatting && (
          <p className="text-[11px] text-olive-700/40 mb-4">Schatting op basis van ingrediënten</p>
        )}
        <table className="w-full text-sm mt-3">
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
                  {vw.schatting ? '± ' : ''}{schaalMacro(vw.per_portie[row.key], 1)}<span className="text-olive-700/40 font-normal text-xs ml-0.5">{row.unit}</span>
                </td>
                <td className="py-2.5 text-right text-olive-700/50 tabular-nums">
                  {vw.schatting ? '± ' : ''}{schaalMacro(vw.per_portie[row.key], aantalPersonen)}<span className="text-olive-700/30 text-xs ml-0.5">{row.unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
