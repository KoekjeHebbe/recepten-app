import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { Recept, Dag } from '../types'
import { DAGEN } from '../types'
import { useWeekMenu } from '../store/weekmenu'
import { useRecepten } from '../store/aangepaste-recepten'

gsap.registerPlugin()

export default function Weekmenu() {
  const { menu, removeFromDay, clearAll } = useWeekMenu()
  const { alleRecepten } = useRecepten()
  const containerRef = useRef<HTMLDivElement>(null)
  const totalItems = DAGEN.reduce((sum, dag) => sum + menu[dag].length, 0)

  function getRecept(id: string): Recept | undefined {
    return alleRecepten.find(r => r.id === id)
  }

  useGSAP(() => {
    if (!containerRef.current) return
    const rows = containerRef.current.querySelectorAll<HTMLElement>('.dag-rij')
    gsap.fromTo(
      rows,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity' }
    )
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-olive-700 tracking-tight">Weekmenu</h1>
        {totalItems > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-olive-700/30 hover:text-terracotta-600 transition-colors btn-magnetic font-medium"
          >
            Alles wissen
          </button>
        )}
      </div>

      {totalItems === 0 && (
        <div className="text-center py-20 text-olive-700/40">
          <p className="text-4xl mb-4">📅</p>
          <p className="mb-2 text-sm">Je weekmenu is leeg.</p>
          <p className="text-xs mb-5 max-w-xs mx-auto leading-relaxed">
            Open een recept en gebruik de <strong className="font-semibold text-olive-700/60">Voeg toe</strong> knop om het aan een dag te koppelen.
          </p>
          <Link to="/" className="inline-block text-terracotta-600 text-sm font-medium underline underline-offset-2">
            Naar recepten →
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {DAGEN.map(dag => {
          const ids = menu[dag]
          const dagRecepten = ids.map(getRecept).filter(Boolean) as Recept[]
          const kcalTotaal = dagRecepten.reduce((sum, r) => sum + r.voedingswaarden.per_portie.calorieen, 0)
          const heeftRecepten = dagRecepten.length > 0

          return (
            <div key={dag} className="dag-rij rounded-3xl bg-white border border-olive-700/8 shadow-card overflow-hidden">
              <div className={`px-5 py-3 flex items-center justify-between border-b ${heeftRecepten ? 'border-olive-700/6 bg-cream/60' : 'border-transparent'}`}>
                <h2 className="font-semibold text-olive-700 capitalize text-sm tracking-wide">{dag}</h2>
                {heeftRecepten && (
                  <span className="text-[11px] font-semibold text-olive-700/40 tabular-nums">
                    {kcalTotaal} kcal/pers.
                  </span>
                )}
              </div>

              {!heeftRecepten ? (
                <div className="px-5 py-3.5 text-xs text-olive-700/25 italic">Nog niets gepland</div>
              ) : (
                <ul className="divide-y divide-olive-700/4">
                  {dagRecepten.map(r => (
                    <li key={r.id} className="flex items-center justify-between px-5 py-3">
                      <Link
                        to={`/recept/${r.id}`}
                        className="text-sm font-medium text-olive-700 hover:text-terracotta-600 transition-colors flex-1 truncate"
                      >
                        {r.titel}
                      </Link>
                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        <span className="text-[11px] text-olive-700/30 font-medium">👥 {r.personen}</span>
                        <button
                          onClick={() => removeFromDay(dag as Dag, r.id)}
                          className="text-olive-700/20 hover:text-terracotta-600 transition-colors text-base btn-magnetic leading-none w-5 h-5 flex items-center justify-center"
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
        <div className="mt-8 flex justify-center">
          <Link
            to="/boodschappen"
            className="bg-terracotta-600 text-white px-8 py-3 rounded-full font-semibold text-sm btn-magnetic shadow-card"
          >
            Genereer boodschappenlijst →
          </Link>
        </div>
      )}
    </div>
  )
}
