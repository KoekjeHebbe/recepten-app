import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  titel: string
  melding?: string
  bevestigLabel?: string
  annuleerLabel?: string
  gevaarlijk?: boolean
  onBevestig: () => void
  onAnnuleer: () => void
}

/** In-app bevestigingsdialoog (vervangt window.confirm), in de huisstijl. */
export default function Bevestiging({
  open, titel, melding, bevestigLabel = 'Bevestig', annuleerLabel = 'Annuleer',
  gevaarlijk = false, onBevestig, onAnnuleer,
}: Props) {
  const bevestigRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    bevestigRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onAnnuleer()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onAnnuleer])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-olive-900/40 backdrop-blur-sm"
      onClick={onAnnuleer}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-4xl bg-white border border-olive-700/10 shadow-card-hover p-6"
      >
        <h2 className="font-semibold text-olive-700 text-base mb-1">{titel}</h2>
        {melding && <p className="text-sm text-olive-700/55 mb-5">{melding}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onAnnuleer}
            className="text-sm font-semibold px-4 py-2 rounded-full border border-olive-700/15 text-olive-700/60 hover:bg-olive-700/8 transition-all btn-magnetic"
          >
            {annuleerLabel}
          </button>
          <button
            ref={bevestigRef}
            onClick={onBevestig}
            className={`text-sm font-semibold px-5 py-2 rounded-full text-white transition-all btn-magnetic ${
              gevaarlijk ? 'bg-terracotta-600 hover:bg-terracotta-700' : 'bg-olive-700 hover:bg-olive-800'
            }`}
          >
            {bevestigLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
