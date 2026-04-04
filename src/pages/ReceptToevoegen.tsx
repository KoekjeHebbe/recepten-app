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

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-stone-500 hover:text-stone-700 mb-4 flex items-center gap-1"
      >
        ← Terug
      </button>

      <h1 className="text-2xl font-bold text-stone-800 mb-6">Recept toevoegen</h1>

      {fout && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {fout}
        </div>
      )}

      {/* Basisinfo */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 mb-4 space-y-4">
        <h2 className="font-semibold text-stone-700">Basisinfo</h2>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Titel *</label>
          <input
            type="text"
            value={titel}
            onChange={e => setTitel(e.target.value)}
            placeholder="Naam van het gerecht"
            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400"
          />
        </div>
        <div className="flex gap-4">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Personen</label>
            <input
              type="number"
              min={1}
              value={personen}
              onChange={e => setPersonen(parseInt(e.target.value) || 1)}
              className="w-24 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Bron URL (optioneel)</label>
          <input
            type="url"
            value={bronUrl}
            onChange={e => setBronUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Afbeelding URL (optioneel)</label>
          <input
            type="url"
            value={afbeeldingUrl}
            onChange={e => setAfbeeldingUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-2">Tags</label>
          <div className="flex flex-wrap gap-2">
            {BESCHIKBARE_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  geselecteerdeTags.includes(tag)
                    ? 'bg-terracotta-100 border-terracotta-300 text-terracotta-700 font-medium'
                    : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ingrediënten */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 mb-4">
        <h2 className="font-semibold text-stone-700 mb-4">Ingrediënten</h2>
        <div className="space-y-2">
          {ingredienten.map((ing, idx) => (
            <div key={ing._key} className="flex gap-2 items-center">
              <input
                type="text"
                value={ing.naam}
                onChange={e => updateIngredient(idx, 'naam', e.target.value)}
                placeholder="Naam"
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400"
              />
              <input
                type="text"
                value={ing.hoeveelheid ?? ''}
                onChange={e => updateIngredient(idx, 'hoeveelheid', e.target.value || null)}
                placeholder="Hoeveel"
                className="w-28 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400"
              />
              <button
                type="button"
                onClick={() => updateIngredient(idx, 'voorraadkast', !ing.voorraadkast)}
                title="Voorraadkast"
                className={`w-9 h-9 rounded-lg border text-sm transition-colors flex-shrink-0 ${
                  ing.voorraadkast
                    ? 'bg-stone-100 border-stone-300 text-stone-600'
                    : 'bg-white border-stone-200 text-stone-300'
                }`}
              >
                🏠
              </button>
              {ingredienten.length > 1 && (
                <button
                  type="button"
                  onClick={() => verwijderIngredient(idx)}
                  className="w-9 h-9 rounded-lg border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200 text-sm transition-colors flex-shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={voegIngredientToe}
          className="mt-3 text-sm text-terracotta-600 hover:text-terracotta-700 font-medium"
        >
          + Ingrediënt toevoegen
        </button>
      </div>

      {/* Bereiding */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 mb-4">
        <h2 className="font-semibold text-stone-700 mb-4">Bereiding</h2>
        <div className="space-y-2">
          {bereiding.map((stap, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <span className="w-6 h-6 mt-2 flex-shrink-0 rounded-full bg-terracotta-100 text-terracotta-700 text-xs font-semibold flex items-center justify-center">
                {idx + 1}
              </span>
              <textarea
                value={stap}
                onChange={e => updateStap(idx, e.target.value)}
                placeholder={`Stap ${idx + 1}`}
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400 resize-none"
              />
              {bereiding.length > 1 && (
                <button
                  type="button"
                  onClick={() => verwijderStap(idx)}
                  className="w-9 h-9 mt-0.5 rounded-lg border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200 text-sm transition-colors flex-shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={voegStapToe}
          className="mt-3 text-sm text-terracotta-600 hover:text-terracotta-700 font-medium"
        >
          + Stap toevoegen
        </button>
      </div>

      {/* Voedingswaarden */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 mb-6">
        <h2 className="font-semibold text-stone-700 mb-4">Voedingswaarden per portie (optioneel)</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            { label: 'Calorieën (kcal)', value: calorieen, set: setCalorieen },
            { label: 'Koolhydraten (g)', value: koolhydraten, set: setKoolhydraten },
            { label: 'Eiwitten (g)', value: eiwitten, set: setEiwitten },
            { label: 'Vetten (g)', value: vetten, set: setVetten },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-xs text-stone-500 mb-1">{label}</label>
              <input
                type="number"
                min={0}
                value={value}
                onChange={e => set(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400"
              />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-500 cursor-pointer">
          <input
            type="checkbox"
            checked={schatting}
            onChange={e => setSchatting(e.target.checked)}
            className="rounded"
          />
          Dit zijn schattingen
        </label>
      </div>

      <button
        onClick={opslaan}
        className="w-full py-3 bg-terracotta-600 hover:bg-terracotta-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
      >
        Recept opslaan
      </button>
    </div>
  )
}
