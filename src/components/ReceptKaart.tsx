import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Plus, Users, Check } from 'lucide-react'
import type { Recept, Dag } from '../types'
import { DAGEN } from '../types'
import TagBadge from './TagBadge'
import { useFavorieten } from '../store/favorieten'
import { useWeekMenu } from '../store/weekmenu'

interface Props {
  recept: Recept
}

const MAALTIJD_TAGS = ['diner', 'lunch', 'bijgerecht', 'tapas', 'ontbijt', 'snack', 'dessert']

export default function ReceptKaart({ recept }: Props) {
  const { isFavoriet, toggleFavoriet } = useFavorieten()
  const { menu, addToDay, removeFromDay, setPorties } = useWeekMenu()
  const [dagPickerOpen, setDagPickerOpen] = useState(false)
  const [pendingPorties, setPendingPorties] = useState<Record<string, number>>({})
  const dagPickerRef = useRef<HTMLDivElement>(null)

  const favoriet = isFavoriet(recept.id)
  const maaltijdTag = recept.tags.find(t => MAALTIJD_TAGS.includes(t))
  const overigeTags = recept.tags.filter(t => t !== 'recept' && t !== maaltijdTag)
  const dagenMetRecept = DAGEN.filter(dag => menu[dag].some(it => it.recept_id === recept.id))
  const vw = recept.voedingswaarden.per_portie

  useEffect(() => {
    if (!dagPickerOpen) return
    function onClick(e: MouseEvent) {
      if (dagPickerRef.current && !dagPickerRef.current.contains(e.target as Node)) {
        setDagPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [dagPickerOpen])

  function handleToggleDay(dag: Dag) {
    const reeds = menu[dag].some(it => it.recept_id === recept.id)
    if (reeds) {
      removeFromDay(dag, recept.id)
    } else {
      const porties = pendingPorties[dag] ?? recept.personen
      addToDay(dag, recept.id, porties)
    }
  }

  return (
    <div className="recept-kaart relative rounded-4xl bg-white border border-olive-700/8 shadow-card card-lift group">
      {/* Afbeelding */}
      <Link to={`/recept/${recept.id}`} className="block">
        <div className="relative overflow-hidden rounded-t-4xl">
          {recept.afbeelding_url ? (
            <img
              src={recept.afbeelding_url}
              alt={recept.titel}
              className="w-full h-44 object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-44 bg-olive-50 flex items-center justify-center text-olive-200 text-5xl">
              🍽
            </div>
          )}
          {maaltijdTag && (
            <div className="absolute top-3 left-3">
              <TagBadge tag={maaltijdTag} />
            </div>
          )}
        </div>

        <div className="p-5 pb-3">
          <h2 className="font-bold text-olive-700 leading-snug group-hover:text-terracotta-600 transition-colors line-clamp-2 mb-2 text-[15px]">
            {recept.titel}
          </h2>
          <div className="flex flex-wrap gap-1 mb-3 min-h-[20px]">
            {overigeTags.slice(0, 3).map(tag => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </div>
      </Link>

      {/* Footer: personen + macros + acties */}
      <div className="px-5 pb-4 flex items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-olive-700/50 mb-1">
            <Users size={12} />
            <span className="font-medium">{recept.personen} pers.</span>
            <span className="mx-1 text-olive-700/20">·</span>
            <span className="font-semibold text-olive-700/70">
              {vw.calorieen}{recept.voedingswaarden.schatting ? ' ±' : ''} kcal
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-olive-700/35 font-medium tracking-wide">
            <span>P {vw.eiwitten}g</span>
            <span className="text-olive-700/15">·</span>
            <span>K {vw.koolhydraten}g</span>
            <span className="text-olive-700/15">·</span>
            <span>V {vw.vetten}g</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Weekmenu picker */}
          <div className="relative" ref={dagPickerRef}>
            <button
              onClick={e => { e.preventDefault(); setDagPickerOpen(p => !p) }}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all btn-magnetic ${
                dagenMetRecept.length > 0
                  ? 'bg-olive-700 border-olive-700 text-white'
                  : 'bg-white border-olive-700/15 text-olive-700/40 hover:border-olive-700/30 hover:text-olive-700'
              }`}
              title="Voeg toe aan weekmenu"
            >
              <Plus size={14} />
            </button>
            {dagPickerOpen && (
              <div className="absolute right-0 bottom-full mb-2 bg-white rounded-3xl shadow-card-hover border border-olive-700/8 z-50 min-w-[220px] py-2 overflow-hidden">
                {DAGEN.map(dag => {
                  const item = menu[dag].find(it => it.recept_id === recept.id)
                  const geselecteerd = !!item
                  const portiesWaarde = item ? item.porties : (pendingPorties[dag] ?? recept.personen)
                  return (
                    <div
                      key={dag}
                      className={`flex items-center gap-2 px-4 py-2 hover:bg-cream transition-colors ${
                        geselecteerd ? 'text-olive-700' : 'text-olive-700/70'
                      }`}
                    >
                      <button
                        onClick={e => { e.preventDefault(); handleToggleDay(dag) }}
                        className="flex-1 text-left text-sm flex items-center gap-2"
                      >
                        {geselecteerd ? (
                          <Check size={12} className="text-terracotta-600 flex-shrink-0" />
                        ) : (
                          <span className="w-3 h-3 flex-shrink-0" />
                        )}
                        <span className={`capitalize ${geselecteerd ? 'font-semibold' : ''}`}>{dag}</span>
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={portiesWaarde}
                        onClick={e => { e.preventDefault(); e.stopPropagation() }}
                        onFocus={e => e.target.select()}
                        onChange={e => {
                          const n = parseFloat(e.target.value)
                          if (!Number.isFinite(n) || n <= 0) return
                          if (geselecteerd) {
                            setPorties(dag, recept.id, n)
                          } else {
                            setPendingPorties(prev => ({ ...prev, [dag]: n }))
                          }
                        }}
                        title="Aantal personen"
                        className={`w-12 text-xs text-right tabular-nums border rounded-lg px-1.5 py-1 focus:outline-none focus:border-olive-700/40 transition-opacity ${
                          geselecteerd
                            ? 'border-olive-700/20 bg-cream text-olive-700'
                            : 'border-olive-700/10 bg-white text-olive-700/50 opacity-60'
                        }`}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Favoriet */}
          <button
            onClick={e => { e.preventDefault(); toggleFavoriet(recept.id) }}
            className="w-8 h-8 rounded-full bg-white border border-olive-700/15 hover:border-terracotta-300 flex items-center justify-center btn-magnetic transition-all"
            title={favoriet ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
          >
            <Heart
              size={14}
              className={favoriet ? 'text-terracotta-600 fill-terracotta-600' : 'text-olive-700/30'}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
