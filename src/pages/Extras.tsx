import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Search, Trash2, Pencil, Check, X, Plus } from 'lucide-react'
import { useAuth } from '../store/auth'
import { api } from '../api/client'
import type { Macros } from '../types'

interface CacheEntry {
  naam_hash: string
  naam: string
  macros: Macros
  bijgewerkt_op: string
}

const LEEG_MACROS: Macros = { calorieen: 0, koolhydraten: 0, eiwitten: 0, vetten: 0 }

const CANONIEKE_EENHEDEN = ['g', 'ml', 'stuk', 'teen', 'plak', 'sneetje', 'handvol', 'snufje'] as const
type CanoniekeEenheid = typeof CANONIEKE_EENHEDEN[number]

// Splits "kipfilet (g)" → { basis: "kipfilet", eenheid: "g" }
function parseNaam(naam: string): { basis: string; eenheid: CanoniekeEenheid } {
  const m = naam.match(/^(.*?)\s*\((\w+)\)\s*$/)
  if (m && (CANONIEKE_EENHEDEN as readonly string[]).includes(m[2])) {
    return { basis: m[1].trim(), eenheid: m[2] as CanoniekeEenheid }
  }
  return { basis: naam.trim(), eenheid: 'g' }
}

function bouwNaam(basis: string, eenheid: CanoniekeEenheid): string {
  return `${basis.trim()} (${eenheid})`
}

// Label voor de "Per"-kolom op basis van eenheid
function eenheidLabel(eenheid: string): string {
  if (eenheid === 'g') return '100g'
  if (eenheid === 'ml') return '100ml'
  return `1 ${eenheid}`
}

// Leid de referentie-eenheid af uit de naam (bijv. "kipfilet (g)" → "100g")
function referentieLabel(naam: string): string {
  return eenheidLabel(parseNaam(naam).eenheid)
}

export default function Extras() {
  const { isIngelogd } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  const [entries, setEntries]         = useState<CacheEntry[]>([])
  const [totaal, setTotaal]           = useState(0)
  const [zoek, setZoek]               = useState('')
  const [paginaGrootte, setPaginaGrootte] = useState(50)
  const [laden, setLaden]             = useState(true)
  const [bewerkHash, setBewerkHash]   = useState<string | null>(null)
  const [bewerkBasis, setBewerkBasis] = useState('')
  const [bewerkEenheid, setBewerkEenheid] = useState<CanoniekeEenheid>('g')
  const [bewerkMacros, setBewerkMacros] = useState<Macros>(LEEG_MACROS)
  const [toonToevoegen, setToonToevoegen] = useState(false)
  const [nieuwBasis, setNieuwBasis]   = useState('')
  const [nieuwEenheid, setNieuwEenheid] = useState<CanoniekeEenheid>('g')
  const [nieuwMacros, setNieuwMacros] = useState<Macros>(LEEG_MACROS)
  const [opslaan, setOpslaan]         = useState(false)

  useGSAP(() => {
    if (!containerRef.current) return
    gsap.fromTo(
      containerRef.current.querySelectorAll<HTMLElement>('.anim-in'),
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, stagger: 0.1, ease: 'power3.out', clearProps: 'transform,opacity' }
    )
  }, { scope: containerRef })

  useEffect(() => {
    if (!isIngelogd) { navigate('/login'); return }
    laadEntries('', 50)
  }, [isIngelogd])

  async function laadEntries(zoekterm = zoek, grootte = paginaGrootte) {
    setLaden(true)
    try {
      const params = new URLSearchParams({ limit: String(grootte) })
      if (zoekterm) params.set('zoek', zoekterm)
      const data = await api.get<{ totaal: number; entries: CacheEntry[] }>(`/cache?${params}`)
      setEntries(data.entries)
      setTotaal(data.totaal)
    } finally {
      setLaden(false)
    }
  }

  function zoekHandler(waarde: string) {
    setZoek(waarde)
    const timer = setTimeout(() => laadEntries(waarde), 350)
    return () => clearTimeout(timer)
  }

  function wisselPaginaGrootte(grootte: number) {
    setPaginaGrootte(grootte)
    laadEntries(zoek, grootte)
  }

  function startBewerken(entry: CacheEntry) {
    const { basis, eenheid } = parseNaam(entry.naam)
    setBewerkHash(entry.naam_hash)
    setBewerkBasis(basis)
    setBewerkEenheid(eenheid)
    setBewerkMacros({ ...entry.macros })
  }

  async function slaBewerkenOp() {
    if (!bewerkHash || !bewerkBasis.trim()) return
    setOpslaan(true)
    try {
      const origEntry = entries.find(e => e.naam_hash === bewerkHash)
      const samengesteldeNaam = bouwNaam(bewerkBasis, bewerkEenheid)
      const payload: { macros: Macros; naam?: string } = { macros: bewerkMacros }
      if (samengesteldeNaam !== origEntry?.naam) payload.naam = samengesteldeNaam
      const result = await api.put<{ ok: boolean; naam_hash?: string; naam?: string; macros?: Macros }>(
        `/cache/${bewerkHash}`, payload
      )
      const nieuweHash = result.naam_hash ?? bewerkHash
      const nieuweNaam = result.naam ?? origEntry?.naam ?? samengesteldeNaam
      setEntries(prev => prev.map(e =>
        e.naam_hash === bewerkHash
          ? { ...e, naam_hash: nieuweHash, naam: nieuweNaam, macros: bewerkMacros }
          : e
      ))
      setBewerkHash(null)
    } finally {
      setOpslaan(false)
    }
  }

  async function verwijder(hash: string) {
    if (!confirm('Deze entry verwijderen uit de cache?')) return
    await api.delete(`/cache/${hash}`)
    setEntries(prev => prev.filter(e => e.naam_hash !== hash))
  }

  async function voegToe() {
    if (!nieuwBasis.trim()) return
    setOpslaan(true)
    try {
      const samengestelde = bouwNaam(nieuwBasis, nieuwEenheid)
      const entry = await api.post<CacheEntry>('/cache', { naam: samengestelde, macros: nieuwMacros })
      setEntries(prev => {
        const gefilterd = prev.filter(e => e.naam_hash !== entry.naam_hash)
        return [entry, ...gefilterd].sort((a, b) => a.naam.localeCompare(b.naam))
      })
      setNieuwBasis('')
      setNieuwEenheid('g')
      setNieuwMacros(LEEG_MACROS)
      setToonToevoegen(false)
    } finally {
      setOpslaan(false)
    }
  }

  function macroInput(
    label: string,
    key: keyof Macros,
    state: Macros,
    setState: (m: Macros) => void
  ) {
    return (
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-olive-700/40 uppercase tracking-widest font-semibold">{label}</label>
        <input
          type="number"
          min={0}
          value={state[key]}
          onFocus={e => e.target.select()}
          onChange={e => setState({ ...state, [key]: Number(e.target.value) })}
          className="w-20 text-sm text-right tabular-nums border border-olive-700/15 rounded-xl px-2 py-1 bg-cream focus:outline-none focus:border-olive-700/40"
        />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="anim-in mb-6">
        <h1 className="font-serif text-2xl font-bold text-olive-700 mb-1">Macro-cache</h1>
        <p className="text-sm text-olive-700/50">
          {totaal} gecachete ingrediënten — macros worden hergebruikt bij het opslaan van recepten.
        </p>
      </div>

      {/* Zoek + toevoegen */}
      <div className="anim-in flex gap-3 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-olive-700/30" />
          <input
            type="text"
            placeholder="Zoek op naam…"
            value={zoek}
            onChange={e => zoekHandler(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-full border border-olive-700/15 bg-white text-sm text-olive-700 placeholder:text-olive-700/30 focus:outline-none focus:border-olive-700/30"
          />
        </div>
        <button
          onClick={() => setToonToevoegen(p => !p)}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-full bg-terracotta-600/10 text-terracotta-600 hover:bg-terracotta-600 hover:text-white transition-all btn-magnetic"
        >
          <Plus size={14} /> Toevoegen
        </button>
      </div>

      {/* Limit selector */}
      <div className="anim-in flex items-center gap-2 mb-4">
        <span className="text-xs text-olive-700/40 font-medium">Toon</span>
        {[50, 100, 250, 500, 5000].map(n => (
          <button
            key={n}
            onClick={() => wisselPaginaGrootte(n)}
            className={`text-xs px-3 py-1 rounded-full transition-all btn-magnetic font-semibold ${
              paginaGrootte === n
                ? 'bg-olive-700 text-cream'
                : 'border border-olive-700/15 text-olive-700/50 hover:border-olive-700/30 hover:text-olive-700'
            }`}
          >
            {n === 5000 ? 'Alles' : n}
          </button>
        ))}
        <span className="text-xs text-olive-700/25 ml-1">
          {entries.length < totaal ? `(${entries.length} van ${totaal})` : `(${totaal})`}
        </span>
      </div>

      {/* Toevoegen-form */}
      {toonToevoegen && (
        <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card p-6 mb-4">
          <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest mb-4">Nieuw ingrediënt</h2>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-olive-700/40 uppercase tracking-widest font-semibold block mb-1">Naam</label>
                <input
                  type="text"
                  placeholder="bijv. kipfilet"
                  value={nieuwBasis}
                  onChange={e => setNieuwBasis(e.target.value)}
                  className="w-full border border-olive-700/15 rounded-2xl px-4 py-2.5 text-sm text-olive-700 bg-cream focus:outline-none focus:border-olive-700/40"
                />
              </div>
              <div>
                <label className="text-[10px] text-olive-700/40 uppercase tracking-widest font-semibold block mb-1">Per</label>
                <select
                  value={nieuwEenheid}
                  onChange={e => setNieuwEenheid(e.target.value as CanoniekeEenheid)}
                  className="border border-olive-700/15 rounded-2xl px-3 py-2.5 text-sm text-olive-700 bg-cream focus:outline-none focus:border-olive-700/40 cursor-pointer"
                >
                  {CANONIEKE_EENHEDEN.map(e => (
                    <option key={e} value={e}>{eenheidLabel(e)}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-olive-700/35 -mt-2">Macro-waarden gelden per {eenheidLabel(nieuwEenheid)}</p>
            <div className="flex flex-wrap gap-4">
              {macroInput('Calorieën (kcal)', 'calorieen',    nieuwMacros, setNieuwMacros)}
              {macroInput('Koolhydraten (g)', 'koolhydraten', nieuwMacros, setNieuwMacros)}
              {macroInput('Eiwitten (g)',     'eiwitten',     nieuwMacros, setNieuwMacros)}
              {macroInput('Vetten (g)',        'vetten',       nieuwMacros, setNieuwMacros)}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setToonToevoegen(false)}
                className="text-sm px-4 py-2 rounded-full text-olive-700/50 hover:bg-olive-700/8 transition-all btn-magnetic"
              >
                Annuleer
              </button>
              <button
                onClick={voegToe}
                disabled={opslaan || !nieuwBasis.trim()}
                className="text-sm font-semibold px-5 py-2 rounded-full bg-olive-700 text-cream hover:bg-olive-800 transition-all btn-magnetic disabled:opacity-40"
              >
                {opslaan ? 'Opslaan…' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card overflow-hidden">
        {laden ? (
          <div className="py-16 text-center text-sm text-olive-700/40">Laden…</div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-sm text-olive-700/40">
            {zoek ? 'Geen resultaten gevonden.' : 'Cache is leeg — sla een recept op om te beginnen.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-olive-700/40 uppercase tracking-widest border-b border-olive-700/6">
                <th className="text-left px-6 py-3 font-semibold">Ingrediënt</th>
                <th className="text-right px-4 py-3 font-semibold">kcal</th>
                <th className="text-right px-4 py-3 font-semibold">KH&nbsp;g</th>
                <th className="text-right px-4 py-3 font-semibold">Eiw&nbsp;g</th>
                <th className="text-right px-4 py-3 font-semibold">Vet&nbsp;g</th>
                <th className="text-right px-4 py-3 font-semibold text-olive-700/25">Per</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-olive-700/4">
              {entries.map(entry => {
                const inBewerking = bewerkHash === entry.naam_hash
                return (
                <tr key={entry.naam_hash} className="hover:bg-cream/60 transition-colors group align-middle">
                  <td className="px-6 py-3 max-w-xs">
                    {inBewerking ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={bewerkBasis}
                          onChange={e => setBewerkBasis(e.target.value)}
                          className="flex-1 text-sm border border-olive-700/20 rounded-lg px-2 py-1 bg-cream text-olive-700 focus:outline-none focus:border-olive-700/40"
                        />
                        <select
                          value={bewerkEenheid}
                          onChange={e => setBewerkEenheid(e.target.value as CanoniekeEenheid)}
                          className="text-xs border border-olive-700/20 rounded-lg px-1.5 py-1 bg-cream text-olive-700 focus:outline-none focus:border-olive-700/40 cursor-pointer"
                        >
                          {CANONIEKE_EENHEDEN.map(e => (
                            <option key={e} value={e}>{e}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-olive-700 font-medium truncate block">{entry.naam}</span>
                    )}
                  </td>

                  {inBewerking ? (
                    <>
                      {(['calorieen', 'koolhydraten', 'eiwitten', 'vetten'] as (keyof Macros)[]).map(key => (
                        <td key={key} className="px-2 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={bewerkMacros[key]}
                            onFocus={e => e.target.select()}
                            onChange={e => setBewerkMacros(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                            className="w-16 text-right tabular-nums border border-olive-700/20 rounded-lg px-2 py-1 bg-cream text-sm focus:outline-none focus:border-olive-700/40"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right text-[10px] text-olive-700/30 font-medium">{eenheidLabel(bewerkEenheid)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={slaBewerkenOp}
                            disabled={opslaan || !bewerkBasis.trim()}
                            className="w-7 h-7 rounded-full bg-olive-700 text-cream flex items-center justify-center hover:bg-olive-800 transition-all disabled:opacity-40"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setBewerkHash(null)}
                            className="w-7 h-7 rounded-full border border-olive-700/15 text-olive-700/50 flex items-center justify-center hover:bg-olive-700/8 transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums text-olive-700">{entry.macros.calorieen}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-olive-700/60">{entry.macros.koolhydraten}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-olive-700/60">{entry.macros.eiwitten}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-olive-700/60">{entry.macros.vetten}</td>
                      <td className="px-4 py-3 text-right text-[10px] text-olive-700/30 font-medium">{referentieLabel(entry.naam)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startBewerken(entry)}
                            className="w-7 h-7 rounded-full border border-olive-700/15 text-olive-700/50 flex items-center justify-center hover:bg-olive-700/8 hover:text-olive-700 transition-all"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => verwijder(entry.naam_hash)}
                            className="w-7 h-7 rounded-full border border-olive-700/15 text-olive-700/30 flex items-center justify-center hover:bg-terracotta-600/10 hover:text-terracotta-600 hover:border-terracotta-300 transition-all"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
