import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  titel: string
  terug?: boolean
  acties?: ReactNode
  ondertitel?: ReactNode
}

/** Eén gedeelde paginakop: serif-titel (huisstijl), optionele terug-knop en acties. */
export default function PageHeader({ titel, terug, acties, ondertitel }: Props) {
  const navigate = useNavigate()
  return (
    <div className="mb-6">
      {terug && (
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-olive-700/50 hover:text-olive-700 mb-4 flex items-center gap-1 transition-colors btn-magnetic"
        >
          <ChevronLeft size={16} aria-hidden="true" /> Terug
        </button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-bold text-olive-700 tracking-tight leading-tight">{titel}</h1>
          {ondertitel && <p className="text-sm text-olive-700/55 mt-1">{ondertitel}</p>}
        </div>
        {acties && <div className="flex items-center gap-2 flex-shrink-0">{acties}</div>}
      </div>
    </div>
  )
}
