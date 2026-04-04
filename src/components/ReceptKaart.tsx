import { Link } from 'react-router-dom'
import type { Recept } from '../types'
import TagBadge from './TagBadge'

interface Props {
  recept: Recept
}

const MAALTIJD_TAGS = ['diner', 'lunch', 'bijgerecht', 'tapas', 'ontbijt', 'snack', 'dessert']

export default function ReceptKaart({ recept }: Props) {
  const maaltijdTag = recept.tags.find(t => MAALTIJD_TAGS.includes(t))
  const overigeTags = recept.tags.filter(t => t !== 'recept' && t !== maaltijdTag)

  return (
    <Link
      to={`/recept/${recept.id}`}
      className="block bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-stone-100 overflow-hidden group"
    >
      {recept.afbeelding_url ? (
        <img
          src={recept.afbeelding_url}
          alt={recept.titel}
          className="w-full h-40 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-40 bg-stone-100 flex items-center justify-center text-stone-300 text-4xl">
          🍽
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="font-semibold text-stone-800 leading-snug group-hover:text-terracotta-600 transition-colors line-clamp-2">
            {recept.titel}
          </h2>
          {maaltijdTag && <TagBadge tag={maaltijdTag} />}
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {overigeTags.map(tag => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-stone-500">
          <span>👥 {recept.personen} pers.</span>
          <span className="font-medium text-stone-700">
            {recept.voedingswaarden.per_portie.calorieen}{recept.voedingswaarden.schatting ? ' ±' : ''} kcal
            <span className="text-stone-400 font-normal"> /portie</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
