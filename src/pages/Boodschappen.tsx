import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Copy, Check, ChevronDown } from 'lucide-react'
import type { Recept, Ingredient, WeekmenuItem } from '../types'
import { DAGEN } from '../types'
import { useWeekMenu } from '../store/weekmenu'
import { useRecepten } from '../store/aangepaste-recepten'
import { CATEGORIE_NAMEN, categoriseer } from '../lib/categorieen'
import { formateerHoeveelheid } from '../lib/eenheden'
import PageHeader from '../components/PageHeader'

interface GegroepeerdeIngredient {
  naam: string
  hoeveelheden: string[]          // geformatteerd, gesommeerd per eenheid: ["350 g", "2 el"]
  voorraadkast: boolean
  categorie: string
  _perEenheid: Map<string, number> // intern: som per exacte eenheid voor aggregatie
}

interface CategoriGroep {
  id: string
  items: GegroepeerdeIngredient[]
}

function voegToe(map: Map<string, GegroepeerdeIngredient>, ing: Ingredient, factor: number) {
  const sleutel = ing.naam.toLowerCase().trim()
  const geschaald = ing.hoeveelheid !== null && ing.hoeveelheid !== undefined
    ? ing.hoeveelheid * factor
    : null

  let bestaand = map.get(sleutel)
  if (!bestaand) {
    bestaand = {
      naam: ing.naam,
      hoeveelheden: [],
      voorraadkast: ing.voorraadkast,
      categorie: ing.categorie || categoriseer(ing.naam),
      _perEenheid: new Map(),
    }
    map.set(sleutel, bestaand)
  }
  // Tel hoeveelheden met dezelfde eenheid bij elkaar op ("200 g" + "150 g" → "350 g")
  if (geschaald !== null) {
    const eh = ing.eenheid ?? ''
    bestaand._perEenheid.set(eh, (bestaand._perEenheid.get(eh) ?? 0) + geschaald)
  }
}

// Zet de gesommeerde hoeveelheden per eenheid om naar weergavestrings
function finaliseerHoeveelheden(g: GegroepeerdeIngredient) {
  g.hoeveelheden = [...g._perEenheid.entries()]
    .map(([eh, som]) => formateerHoeveelheid(som, eh))
    .filter(Boolean)
}

function groepeerIngredienten(items: WeekmenuItem[], alleRecepten: Recept[]): GegroepeerdeIngredient[] {
  const map = new Map<string, GegroepeerdeIngredient>()

  for (const item of items) {
    const recept = alleRecepten.find(r => r.id === item.recept_id)
    if (!recept || !recept.personen) continue
    // Schaal op aantal eters: porties (gepland) / personen (recept)
    const factor = item.porties / recept.personen

    for (const ing of recept.ingredienten) voegToe(map, ing, factor)

    // Onderdelen — sub-recept ingrediënten geschaald op het ouder-recept én
    // op (od.porties / sub.personen) voor de sub-recept verhouding.
    for (const od of recept.onderdelen ?? []) {
      const sub = alleRecepten.find(r => r.id === od.recept_id)
      if (!sub || !sub.personen) continue
      const subFactor = factor * (od.porties / sub.personen)
      for (const ing of sub.ingredienten) voegToe(map, ing, subFactor)
    }
  }

  const lijst = Array.from(map.values())
  lijst.forEach(finaliseerHoeveelheden)
  return lijst.sort((a, b) => {
    const catA = CATEGORIE_NAMEN.indexOf(a.categorie)
    const catB = CATEGORIE_NAMEN.indexOf(b.categorie)
    if (catA !== catB) return catA - catB
    return a.naam.localeCompare(b.naam, 'nl')
  })
}

function formatKeepLijst(groepen: CategoriGroep[], voorraad: GegroepeerdeIngredient[]): string {
  const lines: string[] = []

  for (const groep of groepen) {
    if (groep.items.length === 0) continue
    lines.push(`— ${groep.id.toUpperCase()} —`)
    for (const item of groep.items) {
      const hv = item.hoeveelheden.length > 0 ? item.hoeveelheden.join(' + ') + ' ' : ''
      lines.push(`${hv}${item.naam}`)
    }
    lines.push('')
  }

  if (voorraad.length > 0) {
    lines.push('— VOORRAADKAST (check) —')
    for (const item of voorraad) {
      const hv = item.hoeveelheden.length > 0 ? item.hoeveelheden.join(' + ') + ' ' : ''
      lines.push(`${hv}${item.naam}`)
    }
  }

  return lines.join('\n').trim()
}

// Sorteerbare categorie-rij
function SortabeleCategorie({ groep }: { groep: CategoriGroep }) {
  const [open, setOpen] = useState(true)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: groep.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        {/* Grip handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-olive-700/20 hover:text-olive-700/50 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          tabIndex={-1}
          aria-label={`Versleep categorie ${groep.id}`}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>

        <button
          onClick={() => setOpen(p => !p)}
          aria-expanded={open}
          className="flex items-center gap-1.5 flex-1 text-left"
        >
          <p className="text-[10px] font-bold text-olive-700/40 uppercase tracking-widest">{groep.id}</p>
          <span className="text-[10px] text-olive-700/25 font-semibold">({groep.items.length})</span>
          <ChevronDown
            size={12}
            className={`text-olive-700/25 ml-auto transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          />
        </button>
      </div>

      {open && (
        <ul className="space-y-2 pl-5">
          {groep.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-olive-700">
              <span className="mt-0.5 w-4 h-4 rounded border border-olive-700/15 flex-shrink-0" />
              <span>
                {item.hoeveelheden.length > 0 && (
                  <span className="font-semibold text-olive-700/50 mr-1.5 tabular-nums">
                    {item.hoeveelheden.join(' + ')}
                  </span>
                )}
                {item.naam}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Boodschappen() {
  const { menu } = useWeekMenu()
  const { alleRecepten } = useRecepten()
  const [gekopieerd, setGekopieerd] = useState(false)
  const [kopieerFout, setKopieerFout] = useState(false)
  const [voorraadTonen, setVoorraadTonen] = useState(false)

  const alleItems = useMemo(() => {
    const arr: WeekmenuItem[] = []
    DAGEN.forEach(dag => arr.push(...menu[dag]))
    return arr
  }, [menu])

  const items = useMemo(() => groepeerIngredienten(alleItems, alleRecepten), [alleItems, alleRecepten])
  const boodschappen = items.filter(i => !i.voorraadkast)
  const voorraad = items.filter(i => i.voorraadkast)

  const [volgorde, setVolgorde] = useState<string[]>([])

  // Reset volgorde als weekmenu wijzigt
  const actieveVolgorde = useMemo(() => {
    const aanwezig = [...new Set(boodschappen.map(i => i.categorie))]
    const opgeslagen = volgorde.filter(c => aanwezig.includes(c))
    const nieuw = aanwezig.filter(c => !opgeslagen.includes(c))
    return [...opgeslagen, ...nieuw]
  }, [boodschappen, volgorde])

  const groepen: CategoriGroep[] = useMemo(() =>
    actieveVolgorde.map(cat => ({
      id: cat,
      items: boodschappen.filter(i => i.categorie === cat),
    })).filter(g => g.items.length > 0),
    [actieveVolgorde, boodschappen]
  )

  const betrokkenRecepten = useMemo(() => {
    const uniekeIds = [...new Set(alleItems.map(it => it.recept_id))]
    return uniekeIds.map(id => alleRecepten.find(r => r.id === id)).filter(Boolean) as Recept[]
  }, [alleItems, alleRecepten])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oudIndex = groepen.findIndex(g => g.id === active.id)
    const nieuwIndex = groepen.findIndex(g => g.id === over.id)
    if (oudIndex === -1 || nieuwIndex === -1) return
    const nieuweVolgorde = arrayMove(groepen, oudIndex, nieuwIndex).map(g => g.id)
    setVolgorde(nieuweVolgorde)
  }

  async function kopieerNaarKeep() {
    const tekst = formatKeepLijst(groepen, voorraad)
    const toon = () => { setGekopieerd(true); setTimeout(() => setGekopieerd(false), 2500) }
    try {
      await navigator.clipboard.writeText(tekst)
      toon()
    } catch {
      // Fallback voor onveilige context / geweigerde permissie / oude browsers
      try {
        const ta = document.createElement('textarea')
        ta.value = tekst
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus(); ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        toon()
      } catch {
        setKopieerFout(true)
        setTimeout(() => setKopieerFout(false), 3500)
      }
    }
  }

  if (alleItems.length === 0) {
    return (
      <div className="text-center py-20 text-olive-700/55">
        <p className="text-4xl mb-4">🛒</p>
        <p className="mb-2 text-sm">Je weekmenu is nog leeg — vul het eerst om een lijst te maken.</p>
        <Link to="/weekmenu" className="text-terracotta-600 underline underline-offset-2 text-sm font-medium">
          Naar het weekmenu
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <PageHeader
        titel="Boodschappenlijst"
        acties={(
          <button
            onClick={kopieerNaarKeep}
            className={`btn btn-md ${kopieerFout ? 'bg-terracotta-700 text-white shadow-card' : gekopieerd ? 'btn-secondary' : 'btn-primary'}`}
          >
            {gekopieerd ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {kopieerFout ? 'Kopiëren mislukt' : gekopieerd ? 'Gekopieerd!' : 'Kopieer voor Keep'}
          </button>
        )}
      />

      {/* Betrokken recepten */}
      <div className="rounded-3xl bg-white border border-olive-700/8 shadow-card p-3 mb-4 flex flex-wrap gap-1.5">
        {betrokkenRecepten.map(r => (
          <Link
            key={r.id}
            to={`/recept/${r.id}`}
            className="text-xs bg-cream hover:bg-olive-50 text-olive-700/60 hover:text-olive-700 px-3 py-1 rounded-full transition-all btn-magnetic border border-olive-700/6"
          >
            {r.titel}
          </Link>
        ))}
      </div>

      {/* Boodschappen — versleepbare categorieën */}
      <div className="rounded-4xl bg-white border border-olive-700/8 shadow-card p-6 mb-3">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest">Boodschappen</h2>
          <span className="text-xs text-olive-700/30 font-semibold tabular-nums">{boodschappen.length} items</span>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={groepen.map(g => g.id)} strategy={verticalListSortingStrategy}>
            {groepen.map(groep => (
              <SortabeleCategorie key={groep.id} groep={groep} />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Voorraadkast toggle */}
      <button
        onClick={() => setVoorraadTonen(p => !p)}
        aria-expanded={voorraadTonen}
        className="w-full text-xs text-olive-700/40 hover:text-olive-700 mb-2 flex items-center gap-2 px-2 py-1 transition-colors btn-magnetic font-medium tracking-wide"
      >
        <ChevronDown size={14} aria-hidden="true" className={`transition-transform duration-200 ${voorraadTonen ? '' : '-rotate-90'}`} />
        Voorraadkast items ({voorraad.length})
      </button>

      {voorraadTonen && (
        <div className="rounded-3xl bg-cream border border-olive-700/6 p-5">
          <ul className="space-y-2">
            {voorraad.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-olive-700/50">
                <span className="mt-0.5 w-4 h-4 rounded border border-olive-700/10 flex-shrink-0" />
                <span>
                  {item.hoeveelheden.length > 0 && (
                    <span className="font-semibold mr-1.5 tabular-nums">{item.hoeveelheden.join(' + ')}</span>
                  )}
                  {item.naam}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
