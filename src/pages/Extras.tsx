import { useState, useEffect, useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Search, Trash2, Pencil, Check, X, Plus } from 'lucide-react'
import { api } from '../api/client'
import { verminderBeweging } from '../lib/motion'
import Bevestiging from '../components/Bevestiging'
import PageHeader from '../components/PageHeader'
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
  const [fout, setFout]               = useState('')
  const [teVerwijderen, setTeVerwijderen] = useState<CacheEntry | null>(null)

  useGSAP(() => {
    if (!containerRef.current || verminderBeweging()) return
    gsap.fromTo(
      containerRef.current.querySelectorAll<HTMLElement>('.anim-in'),
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, stagger: 0.1, ease: 'power3.out', clearProps: 'transform,opacity' }
    )
  }, { scope: containerRef })

  // Eerste keer meteen laden; daarna gedebounced bij elke wijziging van de
  // zoekterm. De timer wordt opgeruimd zodat oude (trage) requests niet over
  // nieuwere resultaten heen schrijven.
  const eersteRender = useRef(true)
  useEffect(() => {
    if (eersteRender.current) {
      eersteRender.current = false
      laadEntries(zoek)
      return
    }
    const timer = setTimeout(() => laadEntries(zoek), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoek])

  async function laadEntries(zoekterm = zoek, grootte = paginaGrootte) {
    setLaden(true)
    try {
      const params = new URLSearchParams({ limit: String(grootte) })
      if (zoekterm) params.set('zoek', zoekterm)
      const data = await api.get<{ totaal: number; entries: CacheEntry[] }>(`/cache?${params}`)
      setEntries(data.entries)
      setTotaal(data.totaal)
    } catch {
      setFout('Kon de cache niet laden.')
    } finally {
      setLaden(false)
    }
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
    setFout('')
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
          ? { ...e, naam_hash: nieuweHash, naam: nieuweNaam, macros: result.macros ?? bewerkMacros }
          : e
      ))
      setBewerkHash(null)
    } catch {
      setFout('Opslaan mislukt. Probeer opnieuw.')
    } finally {
      setOpslaan(false)
    }
  }

  async function verwijder(hash: string) {
    setFout('')
    try {
      await api.delete(`/cache/${hash}`)
      setEntries(prev => prev.filter(e => e.naam_hash !== hash))
      setTotaal(t => Math.max(0, t - 1))
    } catch {
      setFout('Verwijderen mislukt. Probeer opnieuw.')
    }
  }

  async function voegToe() {
    if (!nieuwBasis.trim()) return
    setOpslaan(true)
    setFout('')
    try {
      const samengestelde = bouwNaam(nieuwBasis, nieuwEenheid)
      const entry = await api.post<CacheEntry>('/cache', { naam: samengestelde, macros: nieuwMacros })
      setEntries(prev => {
        const bestond = prev.some(e => e.naam_hash === entry.naam_hash)
        const gefilterd = prev.filter(e => e.naam_hash !== entry.naam_hash)
        if (!bestond) setTotaal(t => t + 1)
        return [entry, ...gefilterd].sort((a, b) => a.naam.localeCompare(b.naam))
      })
      setNieuwBasis('')
      setNieuwEenheid('g')
      setNieuwMacros(LEEG_MACROS)
      setToonToevoegen(false)
    } catch {
      setFout('Toevoegen mislukt. Probeer opnieuw.')
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
          inputMode="decimal"
          value={state[key]}
          onFocus={e => e.target.select()}
          onChange={e => setState({ ...state, [key]: Number(e.target.value) })}
          className="w-full sm:w-20 text-base sm:text-sm text-right tabular-nums border border-olive-700/15 rounded-xl px-2 py-1.5 bg-cream focus:outline-none focus:border-olive-700/40"
        />
      </div>
    )
  }

  // Bewerk-formulier — gedeeld door de desktop-tabelrij én de mobiele kaart
  function bewerkPaneel() {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="text-[10px] text-olive-700/40 uppercase tracking-widest font-semibold block mb-1">Ingrediënt</label>
            <input
              type="text"
              value={bewerkBasis}
              onChange={e => setBewerkBasis(e.target.value)}
              className="w-full text-base sm:text-sm border border-olive-700/20 rounded-2xl px-4 py-2.5 bg-white text-olive-700 focus:outline-none focus:border-olive-700/40"
            />
          </div>
          <div>
            <label className="text-[10px] text-olive-700/40 uppercase tracking-widest font-semibold block mb-1">Per</label>
            <select
              value={bewerkEenheid}
              onChange={e => setBewerkEenheid(e.target.value as CanoniekeEenheid)}
              className="w-full sm:w-auto text-base sm:text-sm border border-olive-700/20 rounded-2xl px-3 py-2.5 bg-white text-olive-700 focus:outline-none focus:border-olive-700/40 cursor-pointer"
            >
              {CANONIEKE_EENHEDEN.map(e => (<option key={e} value={e}>{eenheidLabel(e)}</option>))}
            </select>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-olive-700/45 mb-2">Waarden gelden per {eenheidLabel(bewerkEenheid)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              ['calorieen', 'Calorieën (kcal)'],
              ['koolhydraten', 'Koolhydraten (g)'],
              ['eiwitten', 'Eiwitten (g)'],
              ['vetten', 'Vetten (g)'],
            ] as [keyof Macros, string][]).map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[10px] text-olive-700/40 uppercase tracking-widest font-semibold">{label}</label>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={bewerkMacros[key]}
                  onFocus={e => e.target.select()}
                  onChange={e => setBewerkMacros(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-full text-base sm:text-sm text-right tabular-nums border border-olive-700/20 rounded-2xl px-3 py-2.5 bg-white focus:outline-none focus:border-olive-700/40"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setBewerkHash(null)} className="btn btn-outline btn-md">
            <X size={14} aria-hidden="true" /> Annuleer
          </button>
          <button onClick={slaBewerkenOp} disabled={opslaan || !bewerkBasis.trim()} className="btn btn-secondary btn-md">
            <Check size={14} aria-hidden="true" /> {opslaan ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    )
  }

  // Bewerk/verwijder-knoppen — gedeeld
  function acties(entry: CacheEntry) {
    return (
      <>
        <button
          onClick={() => startBewerken(entry)}
          aria-label={`Bewerk ${entry.naam}`}
          className="w-8 h-8 rounded-full border border-olive-700/15 text-olive-700/50 flex items-center justify-center hover:bg-olive-700/8 hover:text-olive-700 transition-all"
        >
          <Pencil size={12} aria-hidden="true" />
        </button>
        <button
          onClick={() => setTeVerwijderen(entry)}
          aria-label={`Verwijder ${entry.naam}`}
          className="w-8 h-8 rounded-full border border-olive-700/15 text-olive-700/40 flex items-center justify-center hover:bg-terracotta-600/10 hover:text-terracotta-600 hover:border-terracotta-300 transition-all"
        >
          <Trash2 size={12} aria-hidden="true" />
        </button>
      </>
    )
  }

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto">
      {/* Header */}
      <PageHeader
        titel="Macro-cache"
        ondertitel={`${totaal} gecachete ingrediënten — macros worden hergebruikt bij het opslaan van recepten.`}
      />

      {fout && (
        <div className="anim-in mb-4 px-4 py-3 bg-terracotta-50 border border-terracotta-200 rounded-2xl text-sm text-terracotta-700 flex items-center justify-between gap-3">
          <span>{fout}</span>
          <button onClick={() => setFout('')} aria-label="Sluit melding" className="text-terracotta-700/60 hover:text-terracotta-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Zoek + toevoegen */}
      <div className="anim-in flex gap-3 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-olive-700/30" />
          <input
            type="text"
            placeholder="Zoek op naam…"
            value={zoek}
            onChange={e => setZoek(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-full border border-olive-700/15 bg-white text-sm text-olive-700 placeholder:text-olive-700/50 focus:outline-none focus:border-olive-700/30"
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
      <div className="anim-in flex flex-wrap items-center gap-2 mb-4">
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
        <span className="text-xs text-olive-700/45 ml-1">
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
              <button onClick={() => setToonToevoegen(false)} className="btn btn-ghost btn-sm">
                Annuleer
              </button>
              <button onClick={voegToe} disabled={opslaan || !nieuwBasis.trim()} className="btn btn-secondary btn-sm">
                {opslaan ? 'Opslaan…' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="anim-in rounded-4xl bg-white border border-olive-700/8 shadow-card overflow-hidden">
        {laden ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-olive-700/15 border-t-terracotta-600 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-sm text-olive-700/55">
            {zoek ? 'Geen resultaten gevonden.' : 'Cache is nog leeg — sla een recept op om te beginnen.'}
          </div>
        ) : (
          <>
            {/* Desktop: tabel */}
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="text-[10px] text-olive-700/40 uppercase tracking-widest border-b border-olive-700/6">
                  <th className="text-left px-6 py-3 font-semibold">Ingrediënt</th>
                  <th className="text-right px-4 py-3 font-semibold">kcal</th>
                  <th className="text-right px-4 py-3 font-semibold">KH&nbsp;g</th>
                  <th className="text-right px-4 py-3 font-semibold">Eiw&nbsp;g</th>
                  <th className="text-right px-4 py-3 font-semibold">Vet&nbsp;g</th>
                  <th className="text-right px-4 py-3 font-semibold text-olive-700/40">Per</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-olive-700/4">
                {entries.map(entry => bewerkHash === entry.naam_hash ? (
                  <tr key={entry.naam_hash} className="bg-cream/50">
                    <td colSpan={7} className="px-6 py-4">{bewerkPaneel()}</td>
                  </tr>
                ) : (
                  <tr key={entry.naam_hash} className="hover:bg-cream/60 transition-colors group align-middle">
                    <td className="px-6 py-3 max-w-xs">
                      <span className="text-olive-700 font-medium truncate block">{entry.naam}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-olive-700">{entry.macros.calorieen}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-olive-700/60">{entry.macros.koolhydraten}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-olive-700/60">{entry.macros.eiwitten}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-olive-700/60">{entry.macros.vetten}</td>
                    <td className="px-4 py-3 text-right text-[10px] text-olive-700/40 font-medium">{referentieLabel(entry.naam)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        {acties(entry)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobiel: kaartlijst */}
            <ul className="sm:hidden divide-y divide-olive-700/6">
              {entries.map(entry => (
                <li key={entry.naam_hash} className="px-4 py-3">
                  {bewerkHash === entry.naam_hash ? bewerkPaneel() : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-olive-700 truncate">{entry.naam}</p>
                        <p className="text-[11px] text-olive-700/55 tabular-nums mt-0.5">
                          {entry.macros.calorieen} kcal · {entry.macros.koolhydraten} KH · {entry.macros.eiwitten} E · {entry.macros.vetten} V
                          <span className="text-olive-700/35"> · per {referentieLabel(entry.naam)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">{acties(entry)}</div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Bevestiging
        open={!!teVerwijderen}
        titel="Verwijderen uit cache?"
        melding={teVerwijderen ? `"${teVerwijderen.naam}" wordt uit de macro-cache verwijderd.` : undefined}
        bevestigLabel="Verwijderen"
        gevaarlijk
        onAnnuleer={() => setTeVerwijderen(null)}
        onBevestig={() => { if (teVerwijderen) verwijder(teVerwijderen.naam_hash); setTeVerwijderen(null) }}
      />
    </div>
  )
}
