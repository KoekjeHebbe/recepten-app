import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRecepten } from '../store/aangepaste-recepten'
import { useFavorieten } from '../store/favorieten'
import ReceptKaart from '../components/ReceptKaart'
import TagBadge from '../components/TagBadge'

gsap.registerPlugin()

const FILTER_TAGS = ['diner', 'lunch', 'bijgerecht', 'tapas', 'kip', 'lamsvlees', 'garnalen', 'pasta', 'wrap', 'flatbread']

export default function ReceptenLijst() {
  const { alleRecepten } = useRecepten()
  const { favorieten } = useFavorieten()
  const [zoek, setZoek] = useState('')
  const [actieveTags, setActieveTags] = useState<string[]>([])
  const [alleenFavorieten, setAlleenFavorieten] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

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

  useGSAP(() => {
    if (!gridRef.current) return
    const cards = gsap.utils.toArray<HTMLElement>('.recept-kaart', gridRef.current)
    if (cards.length === 0) return
    gsap.fromTo(
      cards,
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, stagger: 0.08, ease: 'power3.out', clearProps: 'all' }
    )
  }, { scope: gridRef, dependencies: [gefilterd.length, alleenFavorieten, actieveTags.join(), zoek] })

  return (
    <div>
      {/* Search + add */}
      <div className="mb-5 flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-olive-700/30 text-sm">⌕</span>
          <input
            type="search"
            placeholder="Zoek recept of ingrediënt…"
            value={zoek}
            onChange={e => setZoek(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-full border border-olive-700/10 bg-white shadow-card focus:outline-none focus:ring-2 focus:ring-terracotta-600/30 text-sm text-olive-700 placeholder:text-olive-700/30"
          />
        </div>
        <Link
          to="/recept/nieuw"
          className="px-5 py-2.5 rounded-full bg-terracotta-600 text-white text-sm font-semibold shadow-card btn-magnetic whitespace-nowrap"
        >
          + Recept
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-7">
        <button
          onClick={() => setAlleenFavorieten(p => !p)}
          className={`text-xs px-3 py-1.5 rounded-full border font-semibold tracking-wide transition-all btn-magnetic ${
            alleenFavorieten
              ? 'bg-terracotta-600 text-white border-terracotta-600'
              : 'bg-white border-olive-700/10 text-olive-700/60 hover:border-olive-700/20'
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
            className="text-xs px-2 py-1 rounded-full text-olive-700/40 hover:text-olive-700 underline underline-offset-2 transition-colors"
          >
            wis filters
          </button>
        )}
      </div>

      {gefilterd.length === 0 ? (
        <p className="text-olive-700/40 text-center py-16 text-sm">Geen recepten gevonden.</p>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gefilterd.map(r => (
            <ReceptKaart key={r.id} recept={r} />
          ))}
        </div>
      )}
    </div>
  )
}
