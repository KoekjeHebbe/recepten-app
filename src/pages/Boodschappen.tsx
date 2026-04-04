import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import receptenData from '../data/recepten.json'
import type { Recept } from '../types'
import { DAGEN } from '../types'
import { useWeekMenu } from '../store/weekmenu'

const recepten = receptenData as Recept[]

interface GegroepeerdeIngredient {
  naam: string
  hoeveelheden: string[]
  voorraadkast: boolean
  categorie: string
}

const WINKELINDELING: { naam: string; keywords: string[] }[] = [
  { naam: 'Vlees', keywords: ['gehakt', 'kip', 'lam', 'varken', 'spek', 'chorizo', 'pancetta', 'worst', 'rib', 'shoarma', 'kebab', 'doner', 'filet', 'steak', 'biefstuk', 'bacon', 'entrecote'] },
  { naam: 'Kuisproducten', keywords: [] },
  { naam: 'Droge voeding', keywords: ['pasta', 'spaghetti', 'tagliatelle', 'orzo', 'rijst', 'bloem', 'brood', 'pita', 'flatbread', 'passata', 'bonen', 'linzen', 'tomatenpuree', 'tomatenblokjes', 'polenta', 'couscous', 'noten', 'pijnboom', 'rozijn', 'olijven', 'kapper', 'harissa', 'blik'] },
  { naam: 'Drank', keywords: ['wijn', 'bier', 'bouillon', 'azijn'] },
  { naam: 'Groenten', keywords: ['ajuin', 'ui', 'wortel', 'selder', 'knoflook', 'tomaat', 'paprika', 'courgette', 'aubergine', 'champignon', 'prei', 'spinazie', 'sla', 'rucola', 'peterselie', 'basilicum', 'munt', 'citroen', 'limoen', 'koriander', 'avocado', 'aardappel', 'patata', 'lente-ui', 'rode ui', 'chilipeper', 'peper'] },
  { naam: 'Zuivel', keywords: ['kaas', 'room', 'boter', 'yoghurt', 'melk', 'hüttenkäse', 'mozzarella', 'halloumi', 'feta', 'parmezaan', 'pecorino', 'ei', 'eieren', 'mascarpone', 'crème'] },
  { naam: 'Vis', keywords: ['forel', 'zalm', 'garnalen', 'gambas', 'shrimp', 'tonijn', 'ansjovis', 'inktvis', 'scampi', 'zeevruchten', 'vis'] },
  { naam: 'Diepvries', keywords: ['diepvries'] },
]

const CATEGORIE_VOLGORDE = [...WINKELINDELING.map(c => c.naam), 'Overig']

function categoriseer(naam: string): string {
  const lower = naam.toLowerCase()
  for (const cat of WINKELINDELING) {
    if (cat.keywords.some(kw => lower.includes(kw))) {
      return cat.naam
    }
  }
  return 'Overig'
}

function groepeerIngredienten(ids: string[]): GegroepeerdeIngredient[] {
  const geselecteerd = ids
    .map(id => recepten.find(r => r.id === id))
    .filter(Boolean) as Recept[]

  const map = new Map<string, GegroepeerdeIngredient>()

  for (const recept of geselecteerd) {
    for (const ing of recept.ingredienten) {
      const sleutel = ing.naam.toLowerCase().trim()
      if (map.has(sleutel)) {
        const bestaand = map.get(sleutel)!
        if (ing.hoeveelheid) {
          bestaand.hoeveelheden.push(ing.hoeveelheid)
        }
      } else {
        map.set(sleutel, {
          naam: ing.naam,
          hoeveelheden: ing.hoeveelheid ? [ing.hoeveelheid] : [],
          voorraadkast: ing.voorraadkast,
          categorie: categoriseer(ing.naam),
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

  // Groepeer boodschappen per categorie
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
  const [gekopieerd, setGekopieerd] = useState(false)
  const [voorraadTonen, setVoorraadTonen] = useState(false)

  const alleIds = useMemo(() => {
    const ids: string[] = []
    DAGEN.forEach(dag => ids.push(...menu[dag]))
    return ids
  }, [menu])

  const items = useMemo(() => groepeerIngredienten(alleIds), [alleIds])
  const boodschappen = items.filter(i => !i.voorraadkast)
  const voorraad = items.filter(i => i.voorraadkast)

  // Groepeer voor weergave per categorie
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
    return uniekeIds.map(id => recepten.find(r => r.id === id)).filter(Boolean) as Recept[]
  }, [alleIds])

  async function kopieerNaarKeep() {
    const tekst = formatKeepLijst(items)
    await navigator.clipboard.writeText(tekst)
    setGekopieerd(true)
    setTimeout(() => setGekopieerd(false), 2500)
  }

  if (alleIds.length === 0) {
    return (
      <div className="text-center py-16 text-stone-400">
        <p className="text-4xl mb-3">🛒</p>
        <p className="mb-2">Je weekmenu is leeg.</p>
        <Link to="/weekmenu" className="text-terracotta-600 underline text-sm">
          Stel eerst een weekmenu in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-stone-800">Boodschappenlijst</h1>
        <button
          onClick={kopieerNaarKeep}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
            gekopieerd
              ? 'bg-olive-500 text-white'
              : 'bg-terracotta-600 text-white hover:bg-terracotta-700'
          }`}
        >
          {gekopieerd ? '✓ Gekopieerd!' : '📋 Kopieer voor Keep'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-3 mb-4 flex flex-wrap gap-2">
        {betrokkenRecepten.map(r => (
          <Link
            key={r.id}
            to={`/recept/${r.id}`}
            className="text-xs bg-stone-50 hover:bg-stone-100 text-stone-600 px-2.5 py-1 rounded-lg transition-colors"
          >
            {r.titel}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 mb-4">
        <h2 className="font-semibold text-stone-700 mb-4 text-sm uppercase tracking-wide">
          🛒 Boodschappen ({boodschappen.length})
        </h2>
        <div className="space-y-4">
          {boodschappenPerCategorie.map(({ cat, items: groep }) => (
            <div key={cat}>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">{cat}</p>
              <ul className="space-y-1.5">
                {groep.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-stone-700">
                    <span className="mt-0.5 w-4 h-4 rounded border border-stone-300 flex-shrink-0" />
                    <span>
                      {item.hoeveelheden.length > 0 && (
                        <span className="font-medium text-stone-500 mr-1">
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

      <button
        onClick={() => setVoorraadTonen(p => !p)}
        className="w-full text-sm text-stone-500 hover:text-stone-700 mb-2 flex items-center gap-1.5"
      >
        <span className={`transition-transform ${voorraadTonen ? 'rotate-90' : ''}`}>▶</span>
        Voorraadkast items ({voorraad.length})
      </button>

      {voorraadTonen && (
        <div className="bg-stone-50 rounded-2xl border border-stone-100 p-5">
          <ul className="space-y-2">
            {voorraad.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-stone-500">
                <span className="mt-0.5 w-4 h-4 rounded border border-stone-200 flex-shrink-0" />
                <span>
                  {item.hoeveelheden.length > 0 && (
                    <span className="font-medium mr-1">{item.hoeveelheden.join(' + ')}</span>
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
