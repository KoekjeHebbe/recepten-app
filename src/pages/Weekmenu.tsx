import { Link } from 'react-router-dom'
import receptenData from '../data/recepten.json'
import type { Recept, Dag } from '../types'
import { DAGEN } from '../types'
import { useWeekMenu } from '../store/weekmenu'

const recepten = receptenData as Recept[]

function getRecept(id: string): Recept | undefined {
  return recepten.find(r => r.id === id)
}

export default function Weekmenu() {
  const { menu, removeFromDay, clearAll } = useWeekMenu()
  const totalItems = DAGEN.reduce((sum, dag) => sum + menu[dag].length, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-stone-800">Weekmenu</h1>
        {totalItems > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-stone-400 hover:text-red-500 transition-colors"
          >
            Alles wissen
          </button>
        )}
      </div>

      {totalItems === 0 && (
        <div className="text-center py-16 text-stone-400">
          <p className="text-4xl mb-3">📅</p>
          <p className="mb-2">Je weekmenu is leeg.</p>
          <p className="text-sm">
            Open een recept en gebruik de <strong>Voeg toe</strong> knop om het aan een dag te koppelen.
          </p>
          <Link to="/" className="mt-4 inline-block text-terracotta-600 underline text-sm">
            Naar recepten
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {DAGEN.map(dag => {
          const ids = menu[dag]
          const dagRecepten = ids.map(getRecept).filter(Boolean) as Recept[]

          return (
            <div key={dag} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
              <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                <h2 className="font-semibold text-stone-700 capitalize text-sm">{dag}</h2>
                {dagRecepten.length > 0 && (
                  <span className="text-xs text-stone-400">
                    {dagRecepten.reduce((sum, r) => sum + r.voedingswaarden.per_portie.calorieen, 0)} kcal/pers.
                  </span>
                )}
              </div>

              {dagRecepten.length === 0 ? (
                <div className="px-4 py-3 text-sm text-stone-400 italic">Nog niets gepland</div>
              ) : (
                <ul className="divide-y divide-stone-50">
                  {dagRecepten.map(r => (
                    <li key={r.id} className="flex items-center justify-between px-4 py-2.5">
                      <Link
                        to={`/recept/${r.id}`}
                        className="text-sm font-medium text-stone-700 hover:text-terracotta-600 transition-colors flex-1"
                      >
                        {r.titel}
                      </Link>
                      <div className="flex items-center gap-3 ml-2">
                        <span className="text-xs text-stone-400">👥 {r.personen}</span>
                        <button
                          onClick={() => removeFromDay(dag as Dag, r.id)}
                          className="text-stone-300 hover:text-red-400 transition-colors text-lg leading-none"
                          title="Verwijder"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {totalItems > 0 && (
        <div className="mt-6 flex justify-center">
          <Link
            to="/boodschappen"
            className="bg-terracotta-600 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-terracotta-700 transition-colors shadow-sm"
          >
            Genereer boodschappenlijst →
          </Link>
        </div>
      )}
    </div>
  )
}
