import { Link } from 'react-router-dom'
import { Heart, Plus, Users } from 'lucide-react'
import type { Recept } from '../types'
import TagBadge from './TagBadge'
import Afbeelding from './Afbeelding'
import DagPicker from './DagPicker'
import { useFavorieten } from '../store/favorieten'

interface Props {
  recept: Recept
}

const MAALTIJD_TAGS = ['diner', 'lunch', 'bijgerecht', 'tapas', 'ontbijt', 'snack', 'dessert']

export default function ReceptKaart({ recept }: Props) {
  const { isFavoriet, toggleFavoriet } = useFavorieten()

  const favoriet = isFavoriet(recept.id)
  const maaltijdTag = recept.tags.find(t => MAALTIJD_TAGS.includes(t))
  const overigeTags = recept.tags.filter(t => t !== 'recept' && t !== maaltijdTag)
  const vw = recept.voedingswaarden.per_portie

  return (
    <div className="recept-kaart relative rounded-4xl bg-white border border-olive-700/8 shadow-card card-lift group">
      {/* Afbeelding */}
      <Link to={`/recept/${recept.id}`} className="block">
        <div className="relative overflow-hidden rounded-t-4xl">
          <Afbeelding
            src={recept.afbeelding_url}
            alt={recept.titel}
            className="w-full h-44"
            imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
            fallbackClassName="text-5xl"
          />
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
          <div className="flex items-center gap-2 text-[10px] text-olive-700/55 font-medium tracking-wide">
            <span>P {vw.eiwitten}g</span>
            <span className="text-olive-700/15">·</span>
            <span>K {vw.koolhydraten}g</span>
            <span className="text-olive-700/15">·</span>
            <span>V {vw.vetten}g</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Weekmenu picker */}
          <DagPicker
            recept={recept}
            richting="boven"
            align="rechts"
            renderTrigger={({ open, toggle, actieveDagen }) => (
              <button
                onClick={toggle}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all btn-magnetic ${
                  actieveDagen.length > 0
                    ? 'bg-olive-700 border-olive-700 text-white'
                    : 'bg-white border-olive-700/15 text-olive-700/40 hover:border-olive-700/30 hover:text-olive-700'
                }`}
                title="Voeg toe aan weekmenu"
                aria-label="Voeg toe aan weekmenu"
                aria-expanded={open}
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            )}
          />

          {/* Favoriet */}
          <button
            onClick={e => { e.preventDefault(); toggleFavoriet(recept.id) }}
            className="w-8 h-8 rounded-full bg-white border border-olive-700/15 hover:border-terracotta-300 flex items-center justify-center btn-magnetic transition-all"
            title={favoriet ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
            aria-label={favoriet ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
            aria-pressed={favoriet}
          >
            <Heart
              size={14}
              aria-hidden="true"
              className={favoriet ? 'text-terracotta-600 fill-terracotta-600' : 'text-olive-700/30'}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
