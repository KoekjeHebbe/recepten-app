import { Link } from 'react-router-dom'
import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { Recept, Dag, WeekmenuItem } from '../types'
import { DAGEN } from '../types'
import { useWeekMenu } from '../store/weekmenu'
import { useRecepten } from '../store/aangepaste-recepten'
import { verminderBeweging } from '../lib/motion'
import PageHeader from '../components/PageHeader'
import ReceptKiezer from '../components/ReceptKiezer'

gsap.registerPlugin()

export default function Weekmenu() {
  const { menu, addToDay, removeFromDay, setPorties, clearAll } = useWeekMenu()
  const { alleRecepten } = useRecepten()
  const containerRef = useRef<HTMLDivElement>(null)
  const [kiesDag, setKiesDag] = useState<Dag | null>(null)
  const totalItems = DAGEN.reduce((sum, dag) => sum + menu[dag].length, 0)
  // Nieuw gerecht krijgt hetzelfde aantal personen als wat al gepland staat
  const standaardPorties = DAGEN.flatMap(d => menu[d]).slice(-1)[0]?.porties

  function getRecept(id: string): Recept | undefined {
    return alleRecepten.find(r => r.id === id)
  }

  useGSAP(() => {
    if (!containerRef.current || verminderBeweging()) return
    const rows = containerRef.current.querySelectorAll<HTMLElement>('.dag-rij')
    gsap.fromTo(
      rows,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity' }
    )
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto">
      <PageHeader
        titel="Weekmenu"
        acties={totalItems > 0 ? (
          <button onClick={clearAll} className="btn btn-ghost btn-sm">Alles wissen</button>
        ) : undefined}
      />

      {totalItems === 0 && (
        <div className="text-center py-10 text-olive-700/55">
          <p className="text-4xl mb-4">📅</p>
          <p className="mb-2 text-sm">Nog niets op het menu deze week.</p>
          <p className="text-xs mb-5 max-w-xs mx-auto leading-relaxed">
            Tik hieronder bij een dag op <strong className="font-semibold text-olive-700/70">+ Recept kiezen</strong>, of gebruik <strong className="font-semibold text-olive-700/70">Plan in</strong> op een recept.
          </p>
          <Link to="/" className="inline-block text-terracotta-600 text-sm font-medium underline underline-offset-2">
            Naar recepten →
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {DAGEN.map(dag => {
          const items = menu[dag]
          const dagItems: { item: WeekmenuItem; recept: Recept }[] = items
            .map(item => {
              const recept = getRecept(item.recept_id)
              return recept ? { item, recept } : null
            })
            .filter((x): x is { item: WeekmenuItem; recept: Recept } => x !== null)

          const kcalTotaal = dagItems.reduce(
            (sum, { item, recept }) => sum + (recept.voedingswaarden?.per_portie?.calorieen ?? 0) * item.porties,
            0
          )
          // Per persoon = som van één portie van elk gerecht die dag
          const kcalPerPersoon = dagItems.reduce(
            (sum, { recept }) => sum + (recept.voedingswaarden?.per_portie?.calorieen ?? 0),
            0
          )
          const heeftRecepten = dagItems.length > 0

          return (
            <div key={dag} className="dag-rij rounded-3xl bg-white border border-olive-700/8 shadow-card">
              <div className={`px-5 py-3 flex items-center justify-between rounded-t-3xl border-b ${heeftRecepten ? 'border-olive-700/6 bg-cream/60' : 'border-transparent'}`}>
                <h2 className="font-semibold text-olive-700 capitalize text-sm tracking-wide">{dag}</h2>
                {heeftRecepten && (
                  <span className="text-xs font-semibold text-olive-700/55 tabular-nums" title={`${Math.round(kcalTotaal)} kcal voor iedereen samen`}>
                    {Math.round(kcalPerPersoon)} kcal p.p.
                  </span>
                )}
              </div>

              {heeftRecepten && (
                <ul className="divide-y divide-olive-700/4">
                  {dagItems.map(({ item, recept }) => (
                    <li key={recept.id} className="flex items-center justify-between px-5 py-3">
                      <Link
                        to={`/recept/${recept.id}`}
                        className="text-sm font-medium text-olive-700 hover:text-terracotta-600 transition-colors flex-1 min-w-0 line-clamp-2 leading-snug"
                      >
                        {recept.titel}
                      </Link>
                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPorties(dag as Dag, recept.id, Math.max(1, item.porties - 1))}
                            disabled={item.porties <= 1}
                            aria-label="Minder personen"
                            className="w-8 h-8 rounded-full bg-cream border border-olive-700/15 hover:bg-olive-700/8 disabled:opacity-30 flex items-center justify-center text-olive-700 text-xs transition-all btn-magnetic"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={item.porties}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const n = Math.round(parseFloat(e.target.value))
                              if (Number.isFinite(n) && n > 0) setPorties(dag as Dag, recept.id, n)
                            }}
                            className="w-10 text-base sm:text-xs text-center tabular-nums border border-olive-700/15 rounded-xl px-1 py-0.5 bg-white text-olive-700 focus:outline-none focus:border-olive-700/40"
                            aria-label={`Aantal personen voor ${recept.titel}`}
                            title="Aantal personen"
                          />
                          <button
                            onClick={() => setPorties(dag as Dag, recept.id, item.porties + 1)}
                            aria-label="Meer personen"
                            className="w-8 h-8 rounded-full bg-cream border border-olive-700/15 hover:bg-olive-700/8 flex items-center justify-center text-olive-700 text-xs transition-all btn-magnetic"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromDay(dag as Dag, recept.id)}
                          className="text-olive-700/45 hover:text-terracotta-600 transition-colors text-lg btn-magnetic leading-none w-8 h-8 -mr-2 flex items-center justify-center"
                          title="Verwijder"
                          aria-label={`Verwijder ${recept.titel} van ${dag}`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className={`px-5 ${heeftRecepten ? 'pb-3 pt-1' : 'pb-3.5'}`}>
                {kiesDag === dag ? (
                  <div className="flex items-center gap-2">
                    <ReceptKiezer
                      value=""
                      metOnderdelen
                      autoFocus
                      excludeIds={items.map(it => it.recept_id)}
                      placeholder={`Recept voor ${dag}…`}
                      onChange={id => { if (id) addToDay(dag as Dag, id, standaardPorties); setKiesDag(null) }}
                    />
                    <button onClick={() => setKiesDag(null)} className="text-xs text-olive-700/60 hover:text-olive-700 px-2 py-2">
                      Annuleer
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setKiesDag(dag as Dag)}
                    className={`text-sm font-medium py-1.5 transition-colors ${heeftRecepten ? 'text-olive-700/45 hover:text-terracotta-600' : 'text-terracotta-600 hover:text-terracotta-700'}`}
                  >
                    {heeftRecepten ? '+ Nog een recept' : '+ Recept kiezen'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {totalItems > 0 && (
        <div className="mt-8 flex justify-center">
          <Link to="/boodschappen" className="btn btn-primary btn-md">
            Genereer boodschappenlijst →
          </Link>
        </div>
      )}
    </div>
  )
}
