import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Copy, Check, ChevronDown } from 'lucide-react'
import { api } from '../api/client'

/**
 * Uitleg + bladwijzer voor de Colruyt-helper. De bladwijzer laadt
 * public/colruyt-helper.js op colruyt.be, met de persoonlijke sleutel erin.
 */
export default function ColruytBladwijzer() {
  const [open, setOpen] = useState(false)
  const [sleutel, setSleutel] = useState<string | null>(null)
  const [fout, setFout] = useState('')
  const [gekopieerd, setGekopieerd] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open || sleutel) return
    api.get<{ sleutel: string }>('/colruyt/sleutel')
      .then(d => setSleutel(d.sleutel))
      .catch(e => setFout(e instanceof Error ? e.message : 'Kon de sleutel niet ophalen'))
  }, [open, sleutel])

  const helperUrl = `${window.location.origin}${import.meta.env.BASE_URL}colruyt-helper.js`
  const code = sleutel
    ? `javascript:(function(){var s=document.createElement('script');s.src='${helperUrl}?k=${sleutel}&t='+Date.now();document.body.appendChild(s)})()`
    : ''

  // React waarschuwt bij javascript:-URL's in JSX; daarom via het DOM zetten.
  useEffect(() => {
    if (linkRef.current && code) linkRef.current.setAttribute('href', code)
  }, [code])

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(code)
      setGekopieerd(true)
      setTimeout(() => setGekopieerd(false), 2500)
    } catch {
      setFout('Kopiëren lukte niet — houd de knop ingedrukt en kies "Link kopiëren".')
    }
  }

  async function nieuweSleutel() {
    const d = await api.post<{ sleutel: string }>('/colruyt/sleutel', {})
    setSleutel(d.sleutel)
  }

  return (
    <div className="rounded-3xl bg-white border border-olive-700/8 shadow-card mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <span className="text-xl" aria-hidden="true">🛒</span>
        <span className="flex-1">
          <span className="block font-semibold text-olive-700 text-sm">Bestellen bij Colruyt</span>
          <span className="block text-xs text-olive-700/55">Zet deze lijst op je Xtra-boodschappenlijst</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className={`text-olive-700/45 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 text-sm text-olive-700/80 space-y-3">
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              Sleep de knop hieronder naar je bladwijzerbalk <span className="text-olive-700/50">(eenmalig)</span>.
            </li>
            <li>Open <a href="https://www.colruyt.be/nl" target="_blank" rel="noopener noreferrer" className="text-terracotta-600 underline underline-offset-2 inline-flex items-center gap-0.5">colruyt.be <ExternalLink size={11} aria-hidden="true" /></a> en log in.</li>
            <li>Klik op de bladwijzer: kies per ingrediënt een product en zet alles in één keer op je lijst.</li>
          </ol>
          <p className="text-xs text-olive-700/55">
            Je keuzes worden onthouden voor de volgende keer, en de macro's van die producten
            (via Open Food Facts) worden gebruikt in je recepten.
          </p>

          {fout && <p className="text-xs text-terracotta-700">{fout}</p>}

          {sleutel ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                ref={linkRef}
                onClick={e => e.preventDefault()}
                draggable
                className="btn btn-primary btn-sm cursor-grab"
                title="Sleep mij naar je bladwijzerbalk"
              >
                TNP → Colruyt
              </a>
              <button onClick={kopieer} className="btn btn-outline btn-sm">
                {gekopieerd ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                {gekopieerd ? 'Gekopieerd' : 'Kopieer code'}
              </button>
              <button onClick={nieuweSleutel} className="text-xs text-olive-700/55 underline underline-offset-2 py-1.5">
                nieuwe sleutel
              </button>
            </div>
          ) : !fout && <p className="text-xs text-olive-700/50">Bladwijzer klaarmaken…</p>}

          <p className="text-xs text-olive-700/50">
            Op je telefoon: kopieer de code, maak een bladwijzer van een willekeurige pagina en vervang
            het adres door de gekopieerde code. Op colruyt.be typ je daarna de naam van de bladwijzer in de adresbalk.
          </p>
        </div>
      )}
    </div>
  )
}
