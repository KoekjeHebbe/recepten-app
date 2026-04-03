import { useState, useMemo } from 'react'
import receptenData from '../data/recepten.json'
import type { Recept } from '../types'
import ReceptKaart from '../components/ReceptKaart'
import TagBadge from '../components/TagBadge'

const recepten = receptenData as Recept[]

const FILTER_TAGS = ['diner', 'lunch', 'bijgerecht', 'tapas', 'kip', 'lamsvlees', 'garnalen', 'pasta', 'wrap', 'flatbread']

export default function ReceptenLijst() {
  const [zoek, setZoek] = useState('')
  const [actieveTags, setActieveTags] = useState<string[]>([])

  function toggleTag(tag: string) {
    setActieveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const gefilterd = useMemo(() => {
    return recepten.filter(r => {
      const zoekMatch =
        zoek === '' ||
        r.titel.toLowerCase().includes(zoek.toLowerCase()) ||
        r.tags.some(t => t.toLowerCase().includes(zoek.toLowerCase()))
      const tagMatch =
        actieveTags.length === 0 || actieveTags.every(t => r.tags.includes(t))
      return zoekMatch && tagMatch
    })
  }, [zoek, actieveTags])

  return (
    <div>
      <div className="mb-6">
        <input
          type="search"
          placeholder="Zoek recept of ingredient..."
          value={zoek}
          onChange={e => setZoek(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_TAGS.map(tag => (
          <TagBadge
            key={tag}
            tag={tag}
            onClick={() => toggleTag(tag)}
            active={actieveTags.includes(tag)}
          />
        ))}
        {actieveTags.length > 0 && (
          <button
            onClick={() => setActieveTags([])}
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
