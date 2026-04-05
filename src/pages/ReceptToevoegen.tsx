import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Link2, Loader2, ChevronLeft, Camera, X } from 'lucide-react'
import type { Recept, Ingredient } from '../types'
import { useRecepten, maakId } from '../store/aangepaste-recepten'
import { useAuth } from '../store/auth'
import { api } from '../api/client'

const BESCHIKBARE_TAGS = ['diner', 'lunch', 'bijgerecht', 'tapas', 'ontbijt', 'snack', 'dessert',
  'kip', 'lamsvlees', 'garnalen', 'pasta', 'wrap', 'flatbread', 'gemengd_gehakt', 'vegetarisch', 'vis']

function leegIngredient(): Ingredient & { _key: number } {
  return { naam: '', hoeveelheid: null, voorraadkast: false, _key: Date.now() + Math.random() }
}

export default function ReceptToevoegen() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isBewerkModus = !!id
  const { voegReceptToe, updateRecept, alleRecepten } = useRecepten()
  const { isIngelogd } = useAuth()

  const bestaandRecept = isBewerkModus ? alleRecepten.find(r => r.id === id) : undefined

  const [titel, setTitel] = useState('')
  const [personen, setPersonen] = useState(4)
  const [bronUrl, setBronUrl] = useState('')
  const [afbeeldingUrl, setAfbeeldingUrl] = useState('')
  const [geselecteerdeTags, setGeselecteerdeTags] = useState<string[]>([])
  const [ingredienten, setIngredienten] = useState([leegIngredient()])
  const [bereiding, setBereiding] = useState([''])
  const [calorieen, setCalorieen] = useState('')
  const [koolhydraten, setKoolhydraten] = useState('')
  const [eiwitten, setEiwitten] = useState('')
  const [vetten, setVetten] = useState('')
  const [schatting, setSchatting] = useState(true)
  const [fout, setFout] = useState('')
  const [laden, setLaden] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importLaden, setImportLaden] = useState(false)
  const [importFout, setImportFout] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoMediaType, setFotoMediaType] = useState<string>('image/jpeg')
  const [fotoLaden, setFotoLaden] = useState(false)
  const [fotoFout, setFotoFout] = useState('')

  // Vul formulier in bij bewerkingsmodus
  useEffect(() => {
    if (!bestaandRecept) return
    setTitel(bestaandRecept.titel)
    setPersonen(bestaandRecept.personen)
    setBronUrl(bestaandRecept.bron_url ?? '')
    setAfbeeldingUrl(bestaandRecept.afbeelding_url ?? '')
    setGeselecteerdeTags(bestaandRecept.tags.filter(t => t !== 'recept'))
    setIngredienten(bestaandRecept.ingredienten.map(i => ({ ...i, _key: Math.random() })))
    setBereiding(bestaandRecept.bereiding)
    setCalorieen(String(bestaandRecept.voedingswaarden.per_portie.calorieen || ''))
    setKoolhydraten(String(bestaandRecept.voedingswaarden.per_portie.koolhydraten || ''))
    setEiwitten(String(bestaandRecept.voedingswaarden.per_portie.eiwitten || ''))
    setVetten(String(bestaandRecept.voedingswaarden.per_portie.vetten || ''))
    setSchatting(bestaandRecept.voedingswaarden.schatting)
  }, [bestaandRecept])

  if (!isIngelogd) {
    return (
      <div className="text-center py-20 text-olive-700/40">
        <p className="text-4xl mb-4">🔒</p>
        <p className="mb-4 text-sm">Je moet ingelogd zijn om recepten toe te voegen.</p>
        <Link to="/login" className="text-terracotta-600 underline underline-offset-2 text-sm font-medium">
          Inloggen
        </Link>
      </div>
    )
  }

  function verwerkFoto(file: File) {
    if (!file.type.startsWith('image/')) { setFotoFout('Kies een afbeeldingsbestand.'); return }
    if (file.size > 5 * 1024 * 1024) { setFotoFout('Afbeelding mag maximaal 5MB zijn.'); return }
    setFotoFout('')
    setFotoMediaType(file.type)
    const reader = new FileReader()
    reader.onload = e => setFotoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function importeerViaFoto() {
    if (!fotoPreview) return
    setFotoFout('')
    setFotoLaden(true)
    try {
      // Strip "data:image/jpeg;base64," prefix
      const base64 = fotoPreview.split(',')[1]
      const res = await api.post<Recept>('/foto', { afbeelding: base64, media_type: fotoMediaType })
      setTitel(res.titel || '')
      setPersonen(res.personen || 4)
      setBronUrl('')
      setAfbeeldingUrl('')
      setGeselecteerdeTags(res.tags?.filter((t: string) => t !== 'recept') ?? [])
      if (res.ingredienten?.length) setIngredienten(res.ingredienten.map((i: Ingredient) => ({ ...i, _key: Math.random() })))
      if (res.bereiding?.length) setBereiding(res.bereiding)
      const vw = res.voedingswaarden?.per_portie
      if (vw) {
        setCalorieen(String(vw.calorieen || ''))
        setKoolhydraten(String(vw.koolhydraten || ''))
        setEiwitten(String(vw.eiwitten || ''))
        setVetten(String(vw.vetten || ''))
        setSchatting(true)
      }
      setFotoPreview(null)
    } catch (err) {
      setFotoFout(err instanceof Error ? err.message : 'Importeren mislukt')
    } finally {
      setFotoLaden(false)
    }
  }

  async function importeerViaUrl() {
    if (!importUrl.trim()) return
    setImportFout('')
    setImportLaden(true)
    try {
      const res = await api.post<Recept & { voedingswaarden: Recept['voedingswaarden'] }>('/importeer', { url: importUrl.trim() })
      setTitel(res.titel || '')
      setPersonen(res.personen || 4)
      setBronUrl(res.bron_url ?? importUrl.trim())
      setAfbeeldingUrl(res.afbeelding_url ?? '')
      setGeselecteerdeTags(res.tags?.filter((t: string) => t !== 'recept') ?? [])
      if (res.ingredienten?.length) {
        setIngredienten(res.ingredienten.map((i: Ingredient) => ({ ...i, _key: Math.random() })))
      }
      if (res.bereiding?.length) setBereiding(res.bereiding)
      const vw = res.voedingswaarden?.per_portie
      if (vw) {
        setCalorieen(String(vw.calorieen || ''))
        setKoolhydraten(String(vw.koolhydraten || ''))
        setEiwitten(String(vw.eiwitten || ''))
        setVetten(String(vw.vetten || ''))
      }
      setImportUrl('')
    } catch (err) {
      setImportFout(err instanceof Error ? err.message : 'Importeren mislukt')
    } finally {
      setImportLaden(false)
    }
  }

  function toggleTag(tag: string) {
    setGeselecteerdeTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  function updateIngredient(idx: number, veld: keyof Ingredient, waarde: string | boolean | null) {
    setIngredienten(prev => prev.map((ing, i) => i === idx ? { ...ing, [veld]: waarde } : ing))
  }

  async function opslaan() {
    if (!titel.trim()) { setFout('Vul een titel in.'); return }
    if (ingredienten.every(i => !i.naam.trim())) { setFout('Voeg minstens één ingrediënt toe.'); return }
    if (bereiding.every(s => !s.trim())) { setFout('Voeg minstens één bereidingsstap toe.'); return }
    setFout('')
    setLaden(true)

    const parseMacro = (s: string) => parseFloat(s.replace(',', '.')) || 0
    const cal = parseMacro(calorieen)
    const kh = parseMacro(koolhydraten)
    const eiw = parseMacro(eiwitten)
    const vet = parseMacro(vetten)

    const recept: Recept = {
      id: isBewerkModus ? id! : maakId(titel),
      titel: titel.trim(),
      datum: bestaandRecept?.datum ?? new Date().toISOString().slice(0, 10),
      personen,
      bron_url: bronUrl.trim() || null,
      afbeelding_url: afbeeldingUrl.trim() || null,
      tags: ['recept', ...geselecteerdeTags],
      ingredienten: ingredienten
        .filter(i => i.naam.trim())
        .map(({ naam, hoeveelheid, voorraadkast }) => ({
          naam: naam.trim(),
          hoeveelheid: hoeveelheid?.trim() || null,
          voorraadkast,
        })),
      bereiding: bereiding.filter(s => s.trim()),
      voedingswaarden: {
        per_portie: { calorieen: cal, koolhydraten: kh, eiwitten: eiw, vetten: vet },
        totaal: { calorieen: cal * personen, koolhydraten: kh * personen, eiwitten: eiw * personen, vetten: vet * personen },
        schatting,
      },
    }

    try {
      if (isBewerkModus) {
        await updateRecept(recept)
        navigate(`/recept/${recept.id}`)
      } else {
        const nieuw = await voegReceptToe(recept)
        navigate(`/recept/${nieuw.id}`)
      }
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Opslaan mislukt')
    } finally {
      setLaden(false)
    }
  }

  const inputCls = "w-full px-4 py-2.5 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 placeholder:text-olive-700/25 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25 transition-all"
  const sectionCls = "rounded-4xl bg-white border border-olive-700/8 shadow-card p-7 mb-4"
  const labelCls = "block text-[10px] font-bold text-olive-700/40 uppercase tracking-widest mb-1.5"

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)}
        className="text-sm text-olive-700/40 hover:text-olive-700 mb-5 flex items-center gap-1 transition-colors btn-magnetic">
        <ChevronLeft size={16} /> Terug
      </button>

      <h1 className="text-2xl font-bold text-olive-700 tracking-tight mb-7">
        {isBewerkModus ? 'Recept bewerken' : 'Recept toevoegen'}
      </h1>

      {/* Importeer — alleen bij nieuw recept */}
      {!isBewerkModus && (
        <div className="rounded-4xl bg-white border border-olive-700/8 shadow-card p-7 mb-4 space-y-5">
          <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest">Automatisch importeren</h2>

          {/* URL import */}
          <div>
            <p className="text-xs text-olive-700/40 mb-2.5 flex items-center gap-1.5"><Link2 size={12} /> Via URL</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && importeerViaUrl()}
                placeholder="https://..."
                className="flex-1 px-4 py-2.5 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 placeholder:text-olive-700/25 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25 transition-all"
              />
              <button
                type="button"
                onClick={importeerViaUrl}
                disabled={importLaden || !importUrl.trim()}
                className="px-4 py-2.5 rounded-2xl bg-olive-700 text-cream text-sm font-semibold btn-magnetic transition-all disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
              >
                {importLaden && <Loader2 size={14} className="animate-spin" />}
                {importLaden ? 'Bezig…' : 'Importeer'}
              </button>
            </div>
            {importFout && <p className="mt-2 text-xs text-terracotta-600">{importFout}</p>}
          </div>

          {/* Foto import */}
          <div>
            <p className="text-xs text-olive-700/40 mb-2.5 flex items-center gap-1.5"><Camera size={12} /> Via foto van kookboek</p>
            {!fotoPreview ? (
              <label className="flex flex-col items-center justify-center gap-2 w-full py-8 rounded-2xl border-2 border-dashed border-olive-700/15 hover:border-olive-700/30 hover:bg-olive-50/50 cursor-pointer transition-all">
                <Camera size={22} className="text-olive-700/25" />
                <span className="text-sm text-olive-700/40">Klik om een foto te kiezen</span>
                <span className="text-xs text-olive-700/25">JPG, PNG, WEBP — max 5MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && verwerkFoto(e.target.files[0])}
                />
              </label>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-olive-700/10">
                <img src={fotoPreview} alt="Preview" className="w-full max-h-64 object-contain bg-olive-50" />
                <button
                  type="button"
                  onClick={() => { setFotoPreview(null); setFotoFout('') }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-olive-700/10 flex items-center justify-center hover:bg-cream transition-all"
                >
                  <X size={13} className="text-olive-700/60" />
                </button>
                <div className="p-3 flex gap-2 justify-end bg-white">
                  <button
                    type="button"
                    onClick={importeerViaFoto}
                    disabled={fotoLaden}
                    className="px-4 py-2 rounded-xl bg-olive-700 text-cream text-sm font-semibold btn-magnetic transition-all disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {fotoLaden && <Loader2 size={14} className="animate-spin" />}
                    {fotoLaden ? 'Bezig met analyseren…' : 'Analyseer foto'}
                  </button>
                </div>
              </div>
            )}
            {fotoFout && <p className="mt-2 text-xs text-terracotta-600">{fotoFout}</p>}
          </div>
        </div>
      )}

      {fout && (
        <div className="mb-5 px-5 py-3.5 bg-terracotta-50 border border-terracotta-200 rounded-3xl text-sm text-terracotta-700 font-medium">
          {fout}
        </div>
      )}

      <div className={sectionCls + ' space-y-4'}>
        <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest">Basisinfo</h2>
        <div>
          <label className={labelCls}>Titel *</label>
          <input type="text" value={titel} onChange={e => setTitel(e.target.value)}
            placeholder="Naam van het gerecht" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Personen</label>
          <input type="number" min={1} value={personen}
            onChange={e => setPersonen(parseInt(e.target.value) || 1)}
            className="w-24 px-4 py-2.5 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25" />
        </div>
        <div>
          <label className={labelCls}>Bron URL (optioneel)</label>
          <input type="url" value={bronUrl} onChange={e => setBronUrl(e.target.value)}
            placeholder="https://..." className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Afbeelding URL (optioneel)</label>
          <input type="url" value={afbeeldingUrl} onChange={e => setAfbeeldingUrl(e.target.value)}
            placeholder="https://..." className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Tags</label>
          <div className="flex flex-wrap gap-2">
            {BESCHIKBARE_TAGS.map(tag => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}
                className={`text-[11px] px-3 py-1 rounded-full border font-semibold tracking-wide transition-all btn-magnetic ${
                  geselecteerdeTags.includes(tag)
                    ? 'bg-olive-700 text-cream border-olive-700'
                    : 'bg-cream border-olive-700/10 text-olive-700/50 hover:border-olive-700/20'
                }`}>
                {tag.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={sectionCls}>
        <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest mb-4">Ingrediënten</h2>
        <div className="space-y-2">
          {ingredienten.map((ing, idx) => (
            <div key={ing._key} className="flex gap-2 items-center">
              <input type="text" value={ing.naam}
                onChange={e => updateIngredient(idx, 'naam', e.target.value)}
                placeholder="Naam"
                className="flex-1 px-3 py-2 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 placeholder:text-olive-700/25 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25" />
              <input type="text" value={ing.hoeveelheid ?? ''}
                onChange={e => updateIngredient(idx, 'hoeveelheid', e.target.value || null)}
                placeholder="Hoeveel"
                className="w-28 px-3 py-2 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 placeholder:text-olive-700/25 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25" />
              <button type="button"
                onClick={() => updateIngredient(idx, 'voorraadkast', !ing.voorraadkast)}
                title="Voorraadkast"
                className={`w-9 h-9 rounded-xl border text-sm transition-all btn-magnetic flex-shrink-0 flex items-center justify-center ${ing.voorraadkast ? 'bg-olive-50 border-olive-700/20' : 'bg-white border-olive-700/8 opacity-30'}`}>
                🏠
              </button>
              {ingredienten.length > 1 && (
                <button type="button" onClick={() => setIngredienten(prev => prev.filter((_, i) => i !== idx))}
                  className="w-9 h-9 rounded-xl border border-olive-700/8 text-olive-700/25 hover:text-terracotta-600 hover:border-terracotta-200 text-sm transition-all btn-magnetic flex-shrink-0 flex items-center justify-center">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setIngredienten(prev => [...prev, leegIngredient()])}
          className="mt-4 text-sm text-terracotta-600 hover:text-terracotta-700 font-semibold btn-magnetic transition-colors">
          + Ingrediënt toevoegen
        </button>
      </div>

      <div className={sectionCls}>
        <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest mb-4">Bereiding</h2>
        <div className="space-y-3">
          {bereiding.map((stap, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <span className="w-6 h-6 mt-2.5 flex-shrink-0 rounded-full bg-terracotta-600/10 text-terracotta-600 text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <textarea value={stap} onChange={e => setBereiding(prev => prev.map((s, i) => i === idx ? e.target.value : s))}
                placeholder={`Stap ${idx + 1}`} rows={2}
                className="flex-1 px-4 py-2.5 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 placeholder:text-olive-700/25 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25 resize-none" />
              {bereiding.length > 1 && (
                <button type="button" onClick={() => setBereiding(prev => prev.filter((_, i) => i !== idx))}
                  className="w-9 h-9 mt-1 rounded-xl border border-olive-700/8 text-olive-700/25 hover:text-terracotta-600 hover:border-terracotta-200 text-sm transition-all btn-magnetic flex-shrink-0 flex items-center justify-center">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setBereiding(prev => [...prev, ''])}
          className="mt-4 text-sm text-terracotta-600 hover:text-terracotta-700 font-semibold btn-magnetic transition-colors">
          + Stap toevoegen
        </button>
      </div>

      <div className={sectionCls + ' mb-7'}>
        <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest mb-4">
          Voedingswaarden per portie <span className="text-olive-700/30 font-normal normal-case tracking-normal">(optioneel)</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Calorieën (kcal)', value: calorieen, set: setCalorieen },
            { label: 'Koolhydraten (g)', value: koolhydraten, set: setKoolhydraten },
            { label: 'Eiwitten (g)', value: eiwitten, set: setEiwitten },
            { label: 'Vetten (g)', value: vetten, set: setVetten },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className={labelCls}>{label}</label>
              <input type="text" inputMode="decimal" value={value}
                onChange={e => set(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0"
                className="w-full px-4 py-2.5 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25" />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2.5 text-sm text-olive-700/50 cursor-pointer">
          <input type="checkbox" checked={schatting} onChange={e => setSchatting(e.target.checked)} className="rounded" />
          Dit zijn schattingen
        </label>
      </div>

      <button onClick={opslaan} disabled={laden}
        className="w-full py-3.5 bg-terracotta-600 text-white font-semibold rounded-full transition-all btn-magnetic shadow-card text-sm tracking-wide disabled:opacity-50">
        {laden ? 'Bezig met opslaan...' : isBewerkModus ? 'Wijzigingen opslaan' : 'Recept opslaan'}
      </button>
    </div>
  )
}
