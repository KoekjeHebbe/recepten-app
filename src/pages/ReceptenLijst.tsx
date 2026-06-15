import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { SlidersHorizontal, ArrowUpDown } from 'lucide-react'
import { verminderBeweging } from '../lib/motion'
import { useRecepten } from '../store/aangepaste-recepten'
import { useFavorieten } from '../store/favorieten'
import ReceptKaart from '../components/ReceptKaart'
import TagBadge from '../components/TagBadge'

gsap.registerPlugin()

// Logisch gegroepeerde filters. Binnen een groep geldt OF, tussen groepen EN.
const FILTER_GROEPEN: { id: string; label: string; tags: string[] }[] = [
  { id: 'maaltijd', label: 'Maaltijd', tags: ['diner', 'lunch', 'bijgerecht', 'tapas', 'ontbijt', 'snack', 'dessert'] },
  { id: 'vlees', label: 'Vlees & vis', tags: ['kip', 'kalkoen', 'rund', 'kalf', 'varken', 'lamsvlees', 'konijn', 'wild', 'gemengd_gehakt', 'vis', 'garnalen'] },
  { id: 'soort', label: 'Soort', tags: ['pasta', 'rijst', 'soep', 'salade', 'wrap', 'flatbread'] },
  { id: 'dieet', label: 'Dieet', tags: ['vegetarisch', 'vegan', 'low_carb', 'snel'] },
]

const SORT_OPTIES: { id: string; label: string }[] = [
  { id: 'nieuwste', label: 'Nieuwste eerst' },
  { id: 'oudste', label: 'Oudste eerst' },
  { id: 'titel-az', label: 'Naam (A→Z)' },
  { id: 'titel-za', label: 'Naam (Z→A)' },
  { id: 'kcal-op', label: 'Calorieën (laag→hoog)' },
  { id: 'kcal-af', label: 'Calorieën (hoog→laag)' },
]

const kcal = (r: { voedingswaarden?: { per_portie?: { calorieen?: number } } }) =>
  r.voedingswaarden?.per_portie?.calorieen || 0

// Negeer accenten/diacrieten zodat "creme" ook "crème" vindt
const normaliseer = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function ReceptenLijst() {
  const { alleRecepten } = useRecepten()
  const { favorieten } = useFavorieten()
  const [zoek, setZoek] = useState('')
  const [actieveTags, setActieveTags] = useState<string[]>([])
  const [alleenFavorieten, setAlleenFavorieten] = useState(false)
  const [sortering, setSortering] = useState('nieuwste')
  const [toonFilters, setToonFilters] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  function toggleTag(tag: string) {
    setActieveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  // Tel hoe vaak elke tag voorkomt → toon enkel filters die resultaten hebben.
  const tagTellingen = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of alleRecepten) for (const t of r.tags) m.set(t, (m.get(t) ?? 0) + 1)
    return m
  }, [alleRecepten])

  const zichtbareGroepen = useMemo(() =>
    FILTER_GROEPEN
      .map(g => ({ ...g, tags: g.tags.filter(t => (tagTellingen.get(t) ?? 0) > 0) }))
      .filter(g => g.tags.length > 0),
    [tagTellingen]
  )

  const gefilterd = useMemo(() => {
    const q = normaliseer(zoek.trim())
    return alleRecepten.filter(r => {
      const zoekMatch =
        q === '' ||
        normaliseer(r.titel).includes(q) ||
        r.tags.some(t => normaliseer(t).includes(q)) ||
        r.ingredienten.some(i => normaliseer(i.naam).includes(q))
      // Binnen een groep OF, tussen groepen EN
      const tagMatch = FILTER_GROEPEN.every(groep => {
        const actiefInGroep = groep.tags.filter(t => actieveTags.includes(t))
        return actiefInGroep.length === 0 || actiefInGroep.some(t => r.tags.includes(t))
      })
      const favorietMatch = !alleenFavorieten || favorieten.includes(r.id)
      return zoekMatch && tagMatch && favorietMatch
    })
  }, [zoek, actieveTags, alleenFavorieten, alleRecepten, favorieten])

  const gesorteerd = useMemo(() => {
    const arr = [...gefilterd]
    switch (sortering) {
      case 'titel-az': arr.sort((a, b) => a.titel.localeCompare(b.titel, 'nl')); break
      case 'titel-za': arr.sort((a, b) => b.titel.localeCompare(a.titel, 'nl')); break
      case 'nieuwste': arr.sort((a, b) => (b.datum || '').localeCompare(a.datum || '')); break
      case 'oudste': arr.sort((a, b) => (a.datum || '').localeCompare(b.datum || '')); break
      case 'kcal-op': arr.sort((a, b) => kcal(a) - kcal(b)); break
      case 'kcal-af': arr.sort((a, b) => kcal(b) - kcal(a)); break
    }
    return arr
  }, [gefilterd, sortering])

  const aantalActief = actieveTags.length + (alleenFavorieten ? 1 : 0)

  useGSAP(() => {
    if (!gridRef.current || verminderBeweging()) return
    const cards = gsap.utils.toArray<HTMLElement>('.recept-kaart', gridRef.current)
    if (cards.length === 0) return
    gsap.fromTo(
      cards,
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, stagger: 0.08, ease: 'power3.out', clearProps: 'all' }
    )
  }, { scope: gridRef, dependencies: [gesorteerd.length, sortering, alleenFavorieten, actieveTags.join(), zoek] })

  const selectCls = "appearance-none text-base sm:text-xs font-semibold text-olive-700/70 bg-white border border-olive-700/10 rounded-full pl-8 pr-7 py-2 shadow-card cursor-pointer focus:outline-none focus:ring-2 focus:ring-terracotta-600/25 hover:border-olive-700/20 transition-all"

  return (
    <div>
      {/* Search + add */}
      <div className="mb-3 flex gap-3">
        <div className="relative flex-1">
          <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-olive-700/30 text-sm">⌕</span>
          <input
            type="search"
            placeholder="Zoek recept of ingrediënt…"
            value={zoek}
            onChange={e => setZoek(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-full border border-olive-700/10 bg-white shadow-card focus:outline-none focus:ring-2 focus:ring-terracotta-600/30 text-sm text-olive-700 placeholder:text-olive-700/50"
          />
        </div>
        <Link to="/recept/nieuw" className="btn btn-primary btn-md">
          + Recept
        </Link>
      </div>

      {/* Controls: favorieten · filters-toggle · sortering */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => setAlleenFavorieten(p => !p)}
          aria-pressed={alleenFavorieten}
          className={`text-xs px-3 py-1.5 rounded-full border font-semibold tracking-wide transition-all btn-magnetic ${
            alleenFavorieten
              ? 'bg-terracotta-600 text-white border-terracotta-600'
              : 'bg-white border-olive-700/10 text-olive-700/60 hover:border-olive-700/20'
          }`}
        >
          <span aria-hidden="true">❤️</span> Favorieten {favorieten.length > 0 && `(${favorieten.length})`}
        </button>

        <button
          onClick={() => setToonFilters(p => !p)}
          aria-expanded={toonFilters}
          aria-controls="filterpaneel"
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold tracking-wide transition-all btn-magnetic ${
            toonFilters || actieveTags.length > 0
              ? 'bg-olive-700 text-cream border-olive-700'
              : 'bg-white border-olive-700/10 text-olive-700/60 hover:border-olive-700/20'
          }`}
        >
          <SlidersHorizontal size={12} aria-hidden="true" /> Filters{actieveTags.length > 0 && ` (${actieveTags.length})`}
        </button>

        {aantalActief > 0 && (
          <button
            onClick={() => { setActieveTags([]); setAlleenFavorieten(false) }}
            className="text-xs px-2 py-1 rounded-full text-olive-700/40 hover:text-olive-700 underline underline-offset-2 transition-colors"
          >
            wis filters
          </button>
        )}

        {/* Sortering — rechts uitgelijnd */}
        <div className="relative ml-auto">
          <ArrowUpDown size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-olive-700/40 pointer-events-none" />
          <select
            value={sortering}
            onChange={e => setSortering(e.target.value)}
            className={selectCls}
            aria-label="Sorteer recepten"
          >
            {SORT_OPTIES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-olive-700/40 text-[10px] pointer-events-none">▼</span>
        </div>
      </div>

      {/* Gegroepeerde filterchips */}
      {toonFilters && (
        <div id="filterpaneel" className="rounded-3xl bg-white border border-olive-700/8 shadow-card p-4 mb-5 space-y-3">
          {zichtbareGroepen.map(groep => (
            <div key={groep.id} className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-olive-700/35 uppercase tracking-widest w-full sm:w-24 sm:shrink-0">
                {groep.label}
              </span>
              {groep.tags.map(tag => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  onClick={() => toggleTag(tag)}
                  active={actieveTags.includes(tag)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Resultaattelling */}
      <p className="text-xs text-olive-700/55 mb-4 font-medium">
        {gesorteerd.length} {gesorteerd.length === 1 ? 'recept' : 'recepten'}
        {(aantalActief > 0 || zoek.trim()) && ` van ${alleRecepten.length}`}
      </p>

      {gesorteerd.length === 0 ? (
        <p className="text-olive-700/55 text-center py-16 text-sm">Geen recepten gevonden.</p>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gesorteerd.map(r => (
            <ReceptKaart key={r.id} recept={r} />
          ))}
        </div>
      )}
    </div>
  )
}
