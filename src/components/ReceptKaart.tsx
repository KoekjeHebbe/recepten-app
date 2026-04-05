import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Plus, Users, Check, X } from 'lucide-react'
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
  const { menu, addToDay, removeFromDay } = useWeekMenu()
  const [dagPickerOpen, setDagPickerOpen] = useState(false)

  const favoriet = isFavoriet(recept.id)
  const maaltijdTag = recept.tags.find(t => MAALTIJD_TAGS.includes(t))
  const overigeTags = recept.tags.filter(t => t !== 'recept' && t !== maaltijdTag)
  const dagenMetRecept = DAGEN.filter(dag => menu[dag].includes(recept.id))
  const vw = recept.voedingswaarden.per_portie

  function handleToggleDay(dag: Dag) {
    if (menu[dag].includes(recept.id)) {
      removeFromDay(dag, recept.id)
    } else {
      addToDay(dag, recept.id)
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
          <div className="relative">
            <button
              onClick={() => setDagPickerOpen(p => !p)}
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
              <div className="absolute right-0 bottom-full mb-2 bg-white rounded-3xl shadow-card-hover border border-olive-700/8 z-50 min-w-[168px] py-2 overflow-hidden">
                {DAGEN.map(dag => (
                  <button
                    key={dag}
                    onClick={() => handleToggleDay(dag)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cream transition-colors flex items-center justify-between ${
                      menu[dag].includes(recept.id) ? 'text-olive-700 font-semibold' : 'text-olive-700/70'
                    }`}
                  >
                    <span className="capitalize">{dag}</span>
                    {menu[dag].includes(recept.id) && <Check size={12} className="text-terracotta-600" />}
                  </button>
                ))}
                <div className="border-t border-olive-700/6 mt-1 pt-1">
                  <button
                    onClick={() => setDagPickerOpen(false)}
                    className="w-full text-left px-4 py-2 text-xs text-olive-700/40 hover:bg-cream transition-colors flex items-center gap-1.5"
                  >
                    <X size={10} /> Sluiten
                  </button>
                </div>
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
