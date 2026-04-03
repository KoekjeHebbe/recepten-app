import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import receptenData from '../data/recepten.json'
import type { Recept, Dag } from '../types'
import { DAGEN } from '../types'
import TagBadge from '../components/TagBadge'
import { useWeekMenu } from '../store/weekmenu'

const recepten = receptenData as Recept[]

export default function ReceptDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recept = recepten.find(r => r.id === id)
  const { menu, addToDay, removeFromDay } = useWeekMenu()
  const [dagPickerOpen, setDagPickerOpen] = useState(false)

  if (!recept) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500 mb-4">Recept niet gevonden.</p>
        <Link to="/" className="text-terracotta-600 underline">Terug naar overzicht</Link>
      </div>
    )
  }

  const dagenMetRecept = DAGEN.filter(dag => menu[dag].includes(recept.id))

  function handleToggleDay(dag: Dag) {
    if (menu[dag].includes(recept!.id)) {
      removeFromDay(dag, recept!.id)
    } else {
      addToDay(dag, recept!.id)
    }
  }

  const vw = recept.voedingswaarden

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-stone-500 hover:text-stone-700 mb-4 flex items-center gap-1"
      >
        ← Terug
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="text-2xl font-bold text-stone-800 leading-tight">{recept.titel}</h1>
          <div className="relative">
            <button
              onClick={() => setDagPickerOpen(p => !p)}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                dagenMetRecept.length > 0
                  ? 'bg-olive-100 text-olive-700'
                  : 'bg-terracotta-50 text-terracotta-600 hover:bg-terracotta-100'
              }`}
            >
              📅 {dagenMetRecept.length > 0 ? dagenMetRecept.map(d => d.slice(0, 2)).join(', ') : 'Voeg toe'}
            </button>
            {dagPickerOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-stone-100 z-10 min-w-[160px] py-1">
                {DAGEN.map(dag => (
                  <button
                    key={dag}
                    onClick={() => handleToggleDay(dag)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center justify-between ${
                      menu[dag].includes(recept.id) ? 'text-olive-700 font-medium' : 'text-stone-700'
                    }`}
                  >
                    <span className="capitalize">{dag}</span>
                    {menu[dag].includes(recept.id) && <span className="text-olive-500">✓</span>}
                  </button>
                ))}
                <button
                  onClick={() => setDagPickerOpen(false)}
                  className="w-full text-left px-4 py-2 text-xs text-stone-400 hover:bg-stone-50 border-t border-stone-100"
                >
                  Sluiten
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {recept.tags.filter(t => t !== 'recept').map(tag => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm text-stone-500">
          <span>👥 {recept.personen} personen</span>
          {recept.bron_url && (
            <a
              href={recept.bron_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-terracotta-500 hover:underline"
            >
              Bron ↗
            </a>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 mb-4">
        <h2 className="font-semibold text-stone-700 mb-3">Ingrediënten</h2>
        {recept.ingredienten.some(i => i.voorraadkast) && (
          <>
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-1.5">Voorraadkast</p>
            <ul className="mb-3 space-y-1">
              {recept.ingredienten.filter(i => i.voorraadkast).map((ing, idx) => (
                <li key={idx} className="text-sm text-stone-500 flex gap-2">
                  <span className="text-stone-300">–</span>
                  <span>{ing.hoeveelheid ? `${ing.hoeveelheid} ` : ''}{ing.naam}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-xs text-stone-400 uppercase tracking-wide mb-1.5">Boodschappen</p>
        <ul className="space-y-1">
          {recept.ingredienten.filter(i => !i.voorraadkast).map((ing, idx) => (
            <li key={idx} className="text-sm text-stone-700 flex gap-2">
              <span className="text-stone-300">–</span>
              <span>{ing.hoeveelheid ? `${ing.hoeveelheid} ` : ''}{ing.naam}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 mb-4">
        <h2 className="font-semibold text-stone-700 mb-3">Bereiding</h2>
        <ol className="space-y-3">
          {recept.bereiding.map((stap, idx) => (
            <li key={idx} className="flex gap-3 text-sm text-stone-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-terracotta-100 text-terracotta-700 text-xs font-semibold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <span className="leading-relaxed">{stap}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
        <h2 className="font-semibold text-stone-700 mb-1">Voedingswaarden</h2>
        {vw.schatting && (
          <p className="text-xs text-stone-400 mb-3">Schatting op basis van ingrediënten</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-wide border-b border-stone-100">
                <th className="text-left py-2 font-medium">Macro</th>
                <th className="text-right py-2 font-medium">Per portie</th>
                <th className="text-right py-2 font-medium">Totaal ({recept.personen} pers.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {[
                { label: 'Calorieën', key: 'calorieen' as const, unit: 'kcal' },
                { label: 'Koolhydraten', key: 'koolhydraten' as const, unit: 'g' },
                { label: 'Eiwitten', key: 'eiwitten' as const, unit: 'g' },
                { label: 'Vetten', key: 'vetten' as const, unit: 'g' },
              ].map(row => (
                <tr key={row.key}>
                  <td className="py-2 text-stone-600 font-medium">{row.label}</td>
                  <td className="py-2 text-right text-stone-800">
                    {vw.schatting ? '± ' : ''}{vw.per_portie[row.key]} {row.unit}
                  </td>
                  <td className="py-2 text-right text-stone-500">
                    {vw.schatting ? '± ' : ''}{vw.totaal[row.key]} {row.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
