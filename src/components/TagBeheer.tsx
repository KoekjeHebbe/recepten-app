import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTags } from '../store/tags'
import type { TagOptie } from '../store/tags'
import Bevestiging from './Bevestiging'

type Soort = 'maaltijd' | 'tag'

/** Beheer van de woordenlijst: maaltijdtypes en inhoudstags toevoegen/verwijderen. */
export default function TagBeheer() {
  const { maaltijden, tags, voegToe, verwijder } = useTags()
  const [nieuwMaaltijd, setNieuwMaaltijd] = useState('')
  const [nieuwTag, setNieuwTag] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')
  const [teVerwijderen, setTeVerwijderen] = useState<{ optie: TagOptie; soort: Soort } | null>(null)

  async function toevoegen(soort: Soort) {
    const naam = (soort === 'maaltijd' ? nieuwMaaltijd : nieuwTag).trim()
    if (!naam) return
    setBezig(true)
    setFout('')
    try {
      await voegToe(naam, soort)
      if (soort === 'maaltijd') setNieuwMaaltijd(''); else setNieuwTag('')
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Toevoegen mislukt')
    } finally {
      setBezig(false)
    }
  }

  async function bevestigVerwijderen() {
    if (!teVerwijderen) return
    setFout('')
    try {
      await verwijder(teVerwijderen.optie.id)
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Verwijderen mislukt')
    } finally {
      setTeVerwijderen(null)
    }
  }

  function lijst(opties: TagOptie[], soort: Soort, kleur: string) {
    return (
      <div className="flex flex-wrap gap-2">
        {opties.length === 0 && <p className="text-xs text-olive-700/45">Nog niets toegevoegd.</p>}
        {opties.map(o => (
          <span
            key={o.id}
            className={`group inline-flex items-center gap-1.5 text-xs pl-3 pr-0.5 py-0.5 rounded-full border font-semibold tracking-wide ${kleur}`}
          >
            {o.naam.replace(/_/g, ' ')}
            <span className="tabular-nums opacity-50 font-normal">{o.gebruikt}</span>
            <button
              type="button"
              onClick={() => setTeVerwijderen({ optie: o, soort })}
              aria-label={`Verwijder ${o.naam}`}
              className="w-7 h-7 -my-1 rounded-full flex items-center justify-center opacity-55 hover:opacity-100 hover:text-terracotta-600 hover:bg-white/70 transition-opacity"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
    )
  }

  function invoer(waarde: string, zet: (v: string) => void, soort: Soort, placeholder: string) {
    return (
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={waarde}
          onChange={e => zet(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); toevoegen(soort) } }}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-2 rounded-2xl border border-olive-700/15 bg-white text-base sm:text-sm text-olive-700 placeholder:text-olive-700/50 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25"
        />
        <button
          type="button"
          onClick={() => toevoegen(soort)}
          disabled={bezig || !waarde.trim()}
          className="btn btn-secondary btn-sm"
        >
          <Plus size={14} aria-hidden="true" /> Toevoegen
        </button>
      </div>
    )
  }

  return (
    <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card p-6 sm:p-7 mb-4">
      <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest mb-1">Tags &amp; maaltijdtypes</h2>
      <p className="text-xs text-olive-700/55 mb-5">
        Deze lijst bepaalt welke knoppen je ziet bij een recept en in de filters. Het getal is het
        aantal recepten dat de tag gebruikt; verwijderen haalt de tag niet weg bij die recepten.
      </p>

      {fout && (
        <div className="mb-4 px-4 py-3 bg-terracotta-50 border border-terracotta-200 rounded-2xl text-sm text-terracotta-700">
          {fout}
        </div>
      )}

      <div className="mb-6">
        <p className="text-[11px] font-bold text-olive-700/55 uppercase tracking-widest mb-2">Maaltijdtypes</p>
        {lijst(maaltijden, 'maaltijd', 'bg-terracotta-50 text-terracotta-700 border-terracotta-200')}
        {invoer(nieuwMaaltijd, setNieuwMaaltijd, 'maaltijd', 'Bijv. brunch')}
      </div>

      <div>
        <p className="text-[11px] font-bold text-olive-700/55 uppercase tracking-widest mb-2">Tags</p>
        {lijst(tags, 'tag', 'bg-olive-50 text-olive-600 border-olive-100')}
        {invoer(nieuwTag, setNieuwTag, 'tag', 'Bijv. bbq of eenpansgerecht')}
      </div>

      <Bevestiging
        open={!!teVerwijderen}
        titel="Uit de lijst verwijderen?"
        melding={teVerwijderen
          ? `"${teVerwijderen.optie.naam.replace(/_/g, ' ')}" verdwijnt als keuzeknop.` +
            (teVerwijderen.optie.gebruikt > 0
              ? ` ${teVerwijderen.optie.gebruikt} recept${teVerwijderen.optie.gebruikt === 1 ? '' : 'en'} houden deze tag wel.`
              : '')
          : undefined}
        bevestigLabel="Verwijderen"
        gevaarlijk
        onAnnuleer={() => setTeVerwijderen(null)}
        onBevestig={bevestigVerwijderen}
      />
    </div>
  )
}
