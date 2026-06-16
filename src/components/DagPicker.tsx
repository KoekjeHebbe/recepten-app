import { useState, useRef } from 'react'
import type { ReactNode, MouseEvent } from 'react'
import { Check } from 'lucide-react'
import type { Recept, Dag } from '../types'
import { DAGEN } from '../types'
import { useWeekMenu } from '../store/weekmenu'
import { useClickOutside } from '../lib/useClickOutside'

interface TriggerArgs {
  open: boolean
  toggle: (e: MouseEvent) => void
  actieveDagen: Dag[]
}

interface Props {
  recept: Recept
  align?: 'links' | 'rechts'
  richting?: 'boven' | 'onder'
  renderTrigger: (args: TriggerArgs) => ReactNode
}

/**
 * Weekmenu-dagkiezer: één gedeelde dropdown (dag + porties per dag) die zowel op
 * de receptkaart als op de detailpagina gebruikt wordt. De aanroeper levert via
 * renderTrigger de eigen knop; deze component bezit de open-state, click-outside
 * en de dag/porties-logica.
 */
export default function DagPicker({ recept, align = 'rechts', richting = 'onder', renderTrigger }: Props) {
  const { menu, addToDay, removeFromDay, setPorties } = useWeekMenu()
  const [open, setOpen] = useState(false)
  const [pendingPorties, setPendingPorties] = useState<Record<string, number>>({})
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => setOpen(false))

  const actieveDagen = DAGEN.filter(dag => menu[dag].some(it => it.recept_id === recept.id))

  function toggleDag(dag: Dag) {
    const reeds = menu[dag].some(it => it.recept_id === recept.id)
    if (reeds) removeFromDay(dag, recept.id)
    else addToDay(dag, recept.id, pendingPorties[dag] ?? recept.personen)
  }

  const positie = `${richting === 'onder' ? 'top-full mt-2' : 'bottom-full mb-2'} ${align === 'rechts' ? 'right-0' : 'left-0'}`

  return (
    <div className="relative" ref={ref}>
      {renderTrigger({ open, toggle: (e) => { e.preventDefault(); setOpen(p => !p) }, actieveDagen })}
      {open && (
        <div className={`absolute ${positie} bg-white rounded-3xl shadow-card-hover border border-olive-700/8 z-50 min-w-[220px] py-2 overflow-hidden`}>
          {DAGEN.map(dag => {
            const item = menu[dag].find(it => it.recept_id === recept.id)
            const geselecteerd = !!item
            const portiesWaarde = item ? item.porties : (pendingPorties[dag] ?? recept.personen)
            return (
              <div
                key={dag}
                className={`flex items-center gap-2 px-4 py-2 hover:bg-cream transition-colors ${geselecteerd ? 'text-olive-700' : 'text-olive-700/70'}`}
              >
                <button
                  onClick={e => { e.preventDefault(); toggleDag(dag) }}
                  aria-pressed={geselecteerd}
                  className="flex-1 text-left text-sm flex items-center gap-2"
                >
                  {geselecteerd
                    ? <Check size={12} aria-hidden="true" className="text-terracotta-600 flex-shrink-0" />
                    : <span className="w-3 h-3 flex-shrink-0" />}
                  <span className={`capitalize ${geselecteerd ? 'font-semibold' : ''}`}>{dag}</span>
                </button>
                <input
                  type="number"
                  min={1}
                  value={portiesWaarde}
                  onClick={e => { e.preventDefault(); e.stopPropagation() }}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const n = Math.round(parseFloat(e.target.value))
                    if (!Number.isFinite(n) || n <= 0) return
                    if (geselecteerd) setPorties(dag, recept.id, n)
                    else setPendingPorties(prev => ({ ...prev, [dag]: n }))
                  }}
                  aria-label={`Aantal personen op ${dag}`}
                  title="Aantal personen"
                  className={`w-12 text-base sm:text-xs text-right tabular-nums border rounded-xl px-1.5 py-1 focus:outline-none focus:border-olive-700/40 transition-opacity ${
                    geselecteerd ? 'border-olive-700/20 bg-cream text-olive-700' : 'border-olive-700/10 bg-white text-olive-700/50 opacity-60'
                  }`}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
