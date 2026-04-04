import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recept, Ingredient } from '../types'
import { useRecepten, maakId } from '../store/aangepaste-recepten'

const BESCHIKBARE_TAGS = ['diner', 'lunch', 'bijgerecht', 'tapas', 'ontbijt', 'snack', 'dessert',
  'kip', 'lamsvlees', 'garnalen', 'pasta', 'wrap', 'flatbread', 'gemengd_gehakt', 'vegetarisch', 'vis']

function leegIngredient(): Ingredient & { _key: number } {
  return { naam: '', hoeveelheid: null, voorraadkast: false, _key: Date.now() + Math.random() }
}

export default function ReceptToevoegen() {
  const navigate = useNavigate()
  const { voegReceptToe } = useRecepten()

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

  function toggleTag(tag: string) {
    setGeselecteerdeTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  function updateIngredient(idx: number, veld: keyof Ingredient, waarde: string | boolean | null) {
    setIngredienten(prev => prev.map((ing, i) =>
      i === idx ? { ...ing, [veld]: waarde } : ing
    ))
  }

  function voegIngredientToe() {
    setIngredienten(prev => [...prev, leegIngredient()])
  }

  function verwijderIngredient(idx: number) {
    setIngredienten(prev => prev.filter((_, i) => i !== idx))
  }

  function updateStap(idx: number, waarde: string) {
    setBereiding(prev => prev.map((s, i) => i === idx ? waarde : s))
  }

  function voegStapToe() {
    setBereiding(prev => [...prev, ''])
  }

  function verwijderStap(idx: number) {
    setBereiding(prev => prev.filter((_, i) => i !== idx))
  }

  function opslaan() {
    if (!titel.trim()) { setFout('Vul een titel in.'); return }
    if (ingredienten.every(i => !i.naam.trim())) { setFout('Voeg minstens één ingrediënt toe.'); return }
    if (bereiding.every(s => !s.trim())) { setFout('Voeg minstens één bereidingsstap toe.'); return }
    setFout('')

    const cal = parseInt(calorieen) || 0
    const kh = parseInt(koolhydraten) || 0
    const eiw = parseInt(eiwitten) || 0
    const vet = parseInt(vetten) || 0

    const recept: Recept = {
      id: maakId(titel),
      titel: titel.trim(),
      datum: new Date().toISOString().slice(0, 10),
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
        totaal: {
          calorieen: cal * personen,
          koolhydraten: kh * personen,
          eiwitten: eiw * personen,
          vetten: vet * personen,
        },
        schatting,
      },
    }

    voegReceptToe(recept)
    navigate(`/recept/${recept.id}`)
  }

  const inputCls = "w-full px-4 py-2.5 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 placeholder:text-olive-700/25 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25 transition-all"
  const sectionCls = "rounded-4xl bg-white border border-olive-700/8 shadow-card p-7 mb-4"
  const labelCls = "block text-[10px] font-bold text-olive-700/40 uppercase tracking-widest mb-1.5"

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-olive-700/40 hover:text-olive-700 mb-5 flex items-center gap-1.5 transition-colors btn-magnetic"
      >
        ← Terug
      </button>

      <h1 className="text-2xl font-bold text-olive-700 tracking-tight mb-7">Recept toevoegen</h1>

      {fout && (
        <div className="mb-5 px-5 py-3.5 bg-terracotta-50 border border-terracotta-200 rounded-3xl text-sm text-terracotta-700 font-medium">
          {fout}
        </div>
      )}

      {/* Basisinfo */}
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
                }`}
              >
                {tag.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ingrediënten */}
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
                className={`w-9 h-9 rounded-xl border text-sm transition-all btn-magnetic flex-shrink-0 flex items-center justify-center ${
                  ing.voorraadkast ? 'bg-olive-50 border-olive-700/20' : 'bg-white border-olive-700/8 opacity-30'
                }`}
              >🏠</button>
              {ingredienten.length > 1 && (
                <button type="button" onClick={() => verwijderIngredient(idx)}
                  className="w-9 h-9 rounded-xl border border-olive-700/8 text-olive-700/25 hover:text-terracotta-600 hover:border-terracotta-200 text-sm transition-all btn-magnetic flex-shrink-0 flex items-center justify-center">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={voegIngredientToe}
          className="mt-4 text-sm text-terracotta-600 hover:text-terracotta-700 font-semibold btn-magnetic transition-colors">
          + Ingrediënt toevoegen
        </button>
      </div>

      {/* Bereiding */}
      <div className={sectionCls}>
        <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest mb-4">Bereiding</h2>
        <div className="space-y-3">
          {bereiding.map((stap, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <span className="w-6 h-6 mt-2.5 flex-shrink-0 rounded-full bg-terracotta-600/10 text-terracotta-600 text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <textarea value={stap} onChange={e => updateStap(idx, e.target.value)}
                placeholder={`Stap ${idx + 1}`} rows={2}
                className="flex-1 px-4 py-2.5 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 placeholder:text-olive-700/25 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25 resize-none" />
              {bereiding.length > 1 && (
                <button type="button" onClick={() => verwijderStap(idx)}
                  className="w-9 h-9 mt-1 rounded-xl border border-olive-700/8 text-olive-700/25 hover:text-terracotta-600 hover:border-terracotta-200 text-sm transition-all btn-magnetic flex-shrink-0 flex items-center justify-center">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={voegStapToe}
          className="mt-4 text-sm text-terracotta-600 hover:text-terracotta-700 font-semibold btn-magnetic transition-colors">
          + Stap toevoegen
        </button>
      </div>

      {/* Voedingswaarden */}
      <div className={sectionCls + ' mb-7'}>
        <h2 className="font-semibold text-olive-700 text-sm uppercase tracking-widest mb-4">Voedingswaarden per portie <span className="text-olive-700/30 font-normal normal-case tracking-normal">(optioneel)</span></h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Calorieën (kcal)', value: calorieen, set: setCalorieen },
            { label: 'Koolhydraten (g)', value: koolhydraten, set: setKoolhydraten },
            { label: 'Eiwitten (g)', value: eiwitten, set: setEiwitten },
            { label: 'Vetten (g)', value: vetten, set: setVetten },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className={labelCls}>{label}</label>
              <input type="number" min={0} value={value} onChange={e => set(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2.5 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25" />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2.5 text-sm text-olive-700/50 cursor-pointer">
          <input type="checkbox" checked={schatting} onChange={e => setSchatting(e.target.checked)}
            className="rounded" />
          Dit zijn schattingen
        </label>
      </div>

      <button onClick={opslaan}
        className="w-full py-3.5 bg-terracotta-600 text-white font-semibold rounded-full transition-all btn-magnetic shadow-card text-sm tracking-wide">
        Recept opslaan
      </button>
    </div>
  )
}
