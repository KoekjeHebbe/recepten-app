import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function Login() {
  const navigate = useNavigate()
  const { login, registreer } = useAuth()
  const [modus, setModus] = useState<'login' | 'registreer'>('login')
  const [naam, setNaam] = useState('')
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [uitnodigingscode, setUitnodigingscode] = useState('')
  const [fout, setFout] = useState('')
  const [laden, setLaden] = useState(false)

  async function verstuur(e: React.FormEvent) {
    e.preventDefault()
    setFout('')
    setLaden(true)
    try {
      if (modus === 'login') {
        await login(email, wachtwoord)
      } else {
        await registreer(naam, email, wachtwoord, uitnodigingscode)
      }
      navigate(-1)
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setLaden(false)
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-2xl border border-olive-700/10 bg-white text-sm text-olive-700 placeholder:text-olive-700/25 focus:outline-none focus:ring-2 focus:ring-terracotta-600/25 transition-all"
  const labelCls = "block text-[10px] font-bold text-olive-700/40 uppercase tracking-widest mb-1.5"

  return (
    <div className="max-w-sm mx-auto pt-8">
      <div className="rounded-4xl bg-white border border-olive-700/8 shadow-card p-8">
        <h1 className="text-xl font-bold text-olive-700 mb-1">
          {modus === 'login' ? 'Inloggen' : 'Account aanmaken'}
        </h1>
        <p className="text-sm text-olive-700/40 mb-7">
          {modus === 'login'
            ? 'Log in om recepten toe te voegen en favorieten op te slaan.'
            : 'Maak een account aan om recepten toe te voegen.'}
        </p>

        {fout && (
          <div className="mb-5 px-4 py-3 bg-terracotta-50 border border-terracotta-200 rounded-2xl text-sm text-terracotta-700">
            {fout}
          </div>
        )}

        <form onSubmit={verstuur} className="space-y-4">
          {modus === 'registreer' && (
            <>
              <div>
                <label className={labelCls}>Naam</label>
                <input type="text" value={naam} onChange={e => setNaam(e.target.value)}
                  placeholder="Jouw naam" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Uitnodigingscode</label>
                <input type="text" value={uitnodigingscode} onChange={e => setUitnodigingscode(e.target.value)}
                  placeholder="Geheime code" required className={inputCls} />
              </div>
            </>
          )}
          <div>
            <label className={labelCls}>E-mailadres</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="naam@voorbeeld.be" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Wachtwoord</label>
            <input type="password" value={wachtwoord} onChange={e => setWachtwoord(e.target.value)}
              placeholder="••••••••" required minLength={8} className={inputCls} />
          </div>
          <button type="submit" disabled={laden}
            className="w-full py-3 bg-terracotta-600 text-white font-semibold rounded-full transition-all btn-magnetic shadow-card text-sm disabled:opacity-50">
            {laden ? 'Even geduld...' : modus === 'login' ? 'Inloggen' : 'Account aanmaken'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setModus(m => m === 'login' ? 'registreer' : 'login'); setFout('') }}
            className="text-sm text-olive-700/40 hover:text-olive-700 transition-colors underline underline-offset-2"
          >
            {modus === 'login' ? 'Nog geen account? Registreer hier' : 'Al een account? Log in'}
          </button>
        </div>
      </div>
    </div>
  )
}
