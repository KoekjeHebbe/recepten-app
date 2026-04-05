import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Recept } from '../types'
import { DAGEN } from '../types'
import { useWeekMenu } from '../store/weekmenu'
import { useRecepten } from '../store/aangepaste-recepten'
import { CATEGORIE_NAMEN, categoriseer } from '../lib/categorieen'

interface GegroepeerdeIngredient {
  naam: string
  hoeveelheden: string[]
  voorraadkast: boolean
  categorie: string
}

const CATEGORIE_VOLGORDE = CATEGORIE_NAMEN

function groepeerIngredienten(ids: string[], alleRecepten: Recept[]): GegroepeerdeIngredient[] {
  const geselecteerd = ids
    .map(id => alleRecepten.find(r => r.id === id))
    .filter(Boolean) as Recept[]

  const map = new Map<string, GegroepeerdeIngredient>()

  for (const recept of geselecteerd) {
    for (const ing of recept.ingredienten) {
      const sleutel = ing.naam.toLowerCase().trim()
      if (map.has(sleutel)) {
        const bestaand = map.get(sleutel)!
        if (ing.hoeveelheid) bestaand.hoeveelheden.push(ing.hoeveelheid)
      } else {
        map.set(sleutel, {
          naam: ing.naam,
          hoeveelheden: ing.hoeveelheid ? [ing.hoeveelheid] : [],
          voorraadkast: ing.voorraadkast,
          categorie: ing.categorie || categoriseer(ing.naam),
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const catA = CATEGORIE_VOLGORDE.indexOf(a.categorie)
    const catB = CATEGORIE_VOLGORDE.indexOf(b.categorie)
    if (catA !== catB) return catA - catB
    return a.naam.localeCompare(b.naam, 'nl')
  })
}

function formatKeepLijst(items: GegroepeerdeIngredient[]): string {
  const boodschappen = items.filter(i => !i.voorraadkast)
  const voorraad = items.filter(i => i.voorraadkast)
  const lines: string[] = []

  const perCategorie = new Map<string, GegroepeerdeIngredient[]>()
  for (const item of boodschappen) {
    if (!perCategorie.has(item.categorie)) perCategorie.set(item.categorie, [])
    perCategorie.get(item.categorie)!.push(item)
  }

  for (const cat of CATEGORIE_VOLGORDE) {
    const groep = perCategorie.get(cat)
    if (!groep || groep.length === 0) continue
    lines.push(`— ${cat.toUpperCase()} —`)
    for (const item of groep) {
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

export default function Boodschappen() {
  const { menu } = useWeekMenu()
  const { alleRecepten } = useRecepten()
  const [gekopieerd, setGekopieerd] = useState(false)
  const [voorraadTonen, setVoorraadTonen] = useState(false)

  const alleIds = useMemo(() => {
    const ids: string[] = []
    DAGEN.forEach(dag => ids.push(...menu[dag]))
    return ids
  }, [menu])

  const items = useMemo(() => groepeerIngredienten(alleIds, alleRecepten), [alleIds, alleRecepten])
  const boodschappen = items.filter(i => !i.voorraadkast)
  const voorraad = items.filter(i => i.voorraadkast)

  const boodschappenPerCategorie = useMemo(() => {
    const map = new Map<string, GegroepeerdeIngredient[]>()
    for (const item of boodschappen) {
      if (!map.has(item.categorie)) map.set(item.categorie, [])
      map.get(item.categorie)!.push(item)
    }
    return CATEGORIE_VOLGORDE
      .map(cat => ({ cat, items: map.get(cat) ?? [] }))
      .filter(g => g.items.length > 0)
  }, [boodschappen])

  const betrokkenRecepten = useMemo(() => {
    const uniekeIds = [...new Set(alleIds)]
    return uniekeIds.map(id => alleRecepten.find(r => r.id === id)).filter(Boolean) as Recept[]
  }, [alleIds, alleRecepten])

  async function kopieerNaarKeep() {
    const tekst = formatKeepLijst(items)
    await navigator.clipboard.writeText(tekst)
    setGekopieerd(true)
    setTimeout(() => setGekopieerd(false), 2500)
  }

  if (alleIds.length === 0) {
    return (
      <div className="text-center py-20 text-olive-700/40">
        <p className="text-4xl mb-4">🛒</p>
        <p className="mb-2 text-sm">Je weekmenu is leeg.</p>
        <Link to="/weekmenu" className="text-terracotta-600 underline underline-offset-2 text-sm font-medium">
          Stel eerst een weekmenu in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-olive-700 tracking-tight">Boodschappenlijst</h1>
        <button
          onClick={kopieerNaarKeep}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all btn-magnetic shadow-card ${
            gekopieerd
              ? 'bg-olive-700 text-cream'
              : 'bg-terracotta-600 text-white'
          }`}
        >
          {gekopieerd ? '✓ Gekopieerd!' : '📋 Kopieer voor Keep'}
        </button>
      </div>

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

      {/* Boodschappen per categorie */}
      <div className="rounded-4xl bg-white border border-olive-700/8 shadow-card p-6 mb-3">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest">
            Boodschappen
          </h2>
          <span className="text-xs text-olive-700/30 font-semibold tabular-nums">{boodschappen.length} items</span>
        </div>
        <div className="space-y-5">
          {boodschappenPerCategorie.map(({ cat, items: groep }) => (
            <div key={cat}>
              <p className="text-[10px] font-bold text-olive-700/35 uppercase tracking-widest mb-2">{cat}</p>
              <ul className="space-y-2">
                {groep.map((item, idx) => (
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
            </div>
          ))}
        </div>
      </div>

      {/* Voorraadkast toggle */}
      <button
        onClick={() => setVoorraadTonen(p => !p)}
        className="w-full text-xs text-olive-700/40 hover:text-olive-700 mb-2 flex items-center gap-2 px-2 py-1 transition-colors btn-magnetic font-medium tracking-wide"
      >
        <span className={`transition-transform duration-200 ${voorraadTonen ? 'rotate-90' : ''}`}>▶</span>
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
