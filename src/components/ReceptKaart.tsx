import { Link } from 'react-router-dom'
import type { Recept } from '../types'
import TagBadge from './TagBadge'
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

  return (
    <div className="recept-kaart relative rounded-4xl bg-white border border-olive-700/8 shadow-card card-lift overflow-hidden group">
      <Link to={`/recept/${recept.id}`} className="block">
        <div className="relative overflow-hidden" style={{ borderRadius: '2rem 2rem 0 0' }}>
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

        <div className="p-5">
          <h2 className="font-bold text-olive-700 leading-snug group-hover:text-terracotta-600 transition-colors line-clamp-2 mb-2 text-[15px]">
            {recept.titel}
          </h2>
          <div className="flex flex-wrap gap-1 mb-4 min-h-[20px]">
            {overigeTags.slice(0, 3).map(tag => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-olive-700/50 border-t border-olive-700/6 pt-3">
            <span className="font-medium">👥 {recept.personen} pers.</span>
            <span className="font-semibold text-olive-700/70">
              {recept.voedingswaarden.per_portie.calorieen}
              {recept.voedingswaarden.schatting ? ' ±' : ''} kcal
              <span className="font-normal opacity-70"> /portie</span>
            </span>
          </div>
        </div>
      </Link>

      <button
        onClick={e => { e.preventDefault(); toggleFavoriet(recept.id) }}
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm btn-magnetic"
        title={favoriet ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
      >
        <span className="text-base leading-none">{favoriet ? '❤️' : '🤍'}</span>
      </button>
    </div>
  )
}
