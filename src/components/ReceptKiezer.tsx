import { useState, useMemo, useRef, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { useRecepten } from '../store/aangepaste-recepten'

interface Props {
  value: string
  onChange: (recept_id: string) => void
  excludeIds?: string[]
  placeholder?: string
}

export default function ReceptKiezer({
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Kies een recept…',
}: Props) {
  const { alleRecepten } = useRecepten()
  const [open, setOpen]   = useState(false)
  const [zoek, setZoek]   = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const huidig = alleRecepten.find(r => r.id === value)

  const { matches, verborgen } = useMemo(() => {
    const zonderExcl = alleRecepten.filter(r => !excludeIds.includes(r.id))
    const verborgen  = zonderExcl.filter(r => r.onderdelen && r.onderdelen.length > 0).length
    let pool = zonderExcl.filter(r => !r.onderdelen || r.onderdelen.length === 0)
    if (zoek.trim()) {
      const z = zoek.toLowerCase()
      pool = pool.filter(r => r.titel.toLowerCase().includes(z))
    }
    return { matches: pool.slice(0, 10), verborgen }
  }, [alleRecepten, excludeIds, zoek])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function kies(id: string) {
    onChange(id)
    setOpen(false)
    setZoek('')
  }

  function wis() {
    onChange('')
    setZoek('')
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      {huidig ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-olive-700/10 bg-cream text-sm text-olive-700">
          {huidig.afbeelding_url && (
            <img src={huidig.afbeelding_url} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          )}
          <span className="flex-1 truncate font-medium">{huidig.titel}</span>
          <button
            type="button"
            onClick={wis}
            className="w-6 h-6 rounded-full text-olive-700/40 hover:text-terracotta-600 hover:bg-terracotta-600/10 flex items-center justify-center transition-all flex-shrink-0"
            title="Verwijder selectie"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-olive-700/30 pointer-events-none" />
            <input
              type="text"
              value={zoek}
              placeholder={placeholder}
              onFocus={() => setOpen(true)}
              onChange={e => { setZoek(e.target.value); setOpen(true) }}
              className="w-full pl-8 pr-3 py-2 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 placeholder:text-olive-700/30 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25"
            />
          </div>
          {open && (
            <div className="absolute z-20 left-0 right-0 mt-1 rounded-2xl bg-white border border-olive-700/10 shadow-card max-h-72 overflow-y-auto">
              {matches.length === 0 ? (
                <p className="px-3 py-3 text-xs text-olive-700/40">Geen recepten gevonden.</p>
              ) : (
                matches.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => kies(r.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-olive-700 hover:bg-cream transition-colors"
                  >
                    {r.afbeelding_url ? (
                      <img src={r.afbeelding_url} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <span className="w-7 h-7 rounded-lg bg-olive-700/8 flex-shrink-0" />
                    )}
                    <span className="truncate">{r.titel}</span>
                  </button>
                ))
              )}
              {verborgen > 0 && (
                <p className="px-3 py-2 text-[10px] text-olive-700/35 italic border-t border-olive-700/6">
                  {verborgen} {verborgen === 1 ? 'recept' : 'recepten'} met eigen onderdelen verborgen.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
