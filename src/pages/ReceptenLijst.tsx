import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useRecepten } from '../store/aangepaste-recepten'
import { useFavorieten } from '../store/favorieten'
import ReceptKaart from '../components/ReceptKaart'
import TagBadge from '../components/TagBadge'

const FILTER_TAGS = ['diner', 'lunch', 'bijgerecht', 'tapas', 'kip', 'lamsvlees', 'garnalen', 'pasta', 'wrap', 'flatbread']

export default function ReceptenLijst() {
  const { alleRecepten } = useRecepten()
  const { favorieten } = useFavorieten()
  const [zoek, setZoek] = useState('')
  const [actieveTags, setActieveTags] = useState<string[]>([])
  const [alleenFavorieten, setAlleenFavorieten] = useState(false)

  function toggleTag(tag: string) {
    setActieveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const gefilterd = useMemo(() => {
    return alleRecepten.filter(r => {
      const zoekMatch =
        zoek === '' ||
        r.titel.toLowerCase().includes(zoek.toLowerCase()) ||
        r.tags.some(t => t.toLowerCase().includes(zoek.toLowerCase()))
      const tagMatch =
        actieveTags.length === 0 || actieveTags.every(t => r.tags.includes(t))
      const favorietMatch = !alleenFavorieten || favorieten.includes(r.id)
      return zoekMatch && tagMatch && favorietMatch
    })
  }, [zoek, actieveTags, alleenFavorieten, alleRecepten, favorieten])

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          type="search"
          placeholder="Zoek recept of ingredient..."
          value={zoek}
          onChange={e => setZoek(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400 text-sm"
        />
        <Link
          to="/recept/nieuw"
          className="px-4 py-2.5 rounded-xl bg-terracotta-600 text-white text-sm font-medium shadow-sm hover:bg-terracotta-700 transition-colors whitespace-nowrap"
        >
          + Recept
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setAlleenFavorieten(p => !p)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
            alleenFavorieten
              ? 'bg-terracotta-50 border-terracotta-300 text-terracotta-700'
              : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
          }`}
        >
          ❤️ Favorieten {favorieten.length > 0 && `(${favorieten.length})`}
        </button>
        {FILTER_TAGS.map(tag => (
          <TagBadge
            key={tag}
            tag={tag}
            onClick={() => toggleTag(tag)}
            active={actieveTags.includes(tag)}
          />
        ))}
        {(actieveTags.length > 0 || alleenFavorieten) && (
          <button
            onClick={() => { setActieveTags([]); setAlleenFavorieten(false) }}
            className="text-xs px-2 py-0.5 rounded-full text-stone-500 hover:text-stone-700 underline"
          >
            wis filters
          </button>
        )}
      </div>

      {gefilterd.length === 0 ? (
        <p className="text-stone-500 text-center py-12">Geen recepten gevonden.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gefilterd.map(r => (
            <ReceptKaart key={r.id} recept={r} />
          ))}
        </div>
      )}
    </div>
  )
}
