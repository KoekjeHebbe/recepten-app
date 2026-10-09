import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../api/client'
import Afbeelding from './Afbeelding'

interface Koppeling {
  ingredient: string
  product: { id: string; naam: string; merk: string; inhoud: string; afbeelding: string | null }
  macros: { calorieen: number; koolhydraten: number; eiwitten: number; vetten: number } | null
  macros_bron: string | null
}

/** Overzicht van de Colruyt-producten die per ingrediënt gekozen zijn (via de bladwijzer). */
export default function ColruytKoppelingen() {
  const [lijst, setLijst] = useState<Koppeling[] | null>(null)
  const [fout, setFout] = useState('')

  useEffect(() => {
    api.get<{ koppelingen: Koppeling[] }>('/colruyt/koppelingen')
      .then(d => setLijst(d.koppelingen))
      .catch(e => setFout(e instanceof Error ? e.message : 'Laden mislukt'))
  }, [])

  async function vergeet(ingredient: string) {
    try {
      await api.delete(`/colruyt/koppelingen/${encodeURIComponent(ingredient)}`)
      setLijst(prev => prev?.filter(k => k.ingredient !== ingredient) ?? null)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Verwijderen mislukt')
    }
  }

  return (
    <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card p-5 sm:p-7 mb-4">
      <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest mb-1">Colruyt-producten</h2>
      <p className="text-xs text-olive-700/55 mb-4">
        Welk product je per ingrediënt koos via de Colruyt-bladwijzer. Gevonden macro's (Open Food Facts)
        vervangen de schatting in je recepten. Vergeten = volgende keer opnieuw kiezen; de macro's blijven staan.
      </p>
      {fout && <p className="text-sm text-terracotta-700 mb-3">{fout}</p>}
      {lijst === null && !fout && <p className="text-xs text-olive-700/50">Laden…</p>}
      {lijst?.length === 0 && (
        <p className="text-xs text-olive-700/50">Nog niets gekoppeld — gebruik de bladwijzer onder je boodschappenlijst.</p>
      )}
      <ul className="divide-y divide-olive-700/6">
        {lijst?.map(k => (
          <li key={k.ingredient} className="flex items-center gap-3 py-2.5">
            <Afbeelding src={k.product.afbeelding} alt="" className="w-10 h-10 rounded-xl flex-shrink-0 bg-white" imgClassName="object-contain" fallbackClassName="text-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-olive-700 truncate">{k.ingredient}</p>
              <p className="text-xs text-olive-700/60 truncate">{k.product.naam}{k.product.inhoud ? ` · ${k.product.inhoud}` : ''}</p>
              <p className="text-[11px] text-olive-700/50 tabular-nums">
                {k.macros
                  ? `${Math.round(k.macros.calorieen)} kcal · ${Math.round(k.macros.koolhydraten)}g KH · ${Math.round(k.macros.eiwitten)}g E · ${Math.round(k.macros.vetten)}g V per 100 g`
                  : 'geen macro\'s gevonden — schatting blijft'}
              </p>
            </div>
            <button
              onClick={() => vergeet(k.ingredient)}
              aria-label={`Vergeet product voor ${k.ingredient}`}
              className="w-9 h-9 rounded-xl border border-olive-700/10 text-olive-700/45 hover:text-terracotta-600 flex items-center justify-center flex-shrink-0"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
