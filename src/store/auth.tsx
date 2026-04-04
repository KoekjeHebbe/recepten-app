import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../api/client'

interface Gebruiker {
  id: number
  naam: string
  email: string
}

interface AuthContext {
  gebruiker: Gebruiker | null
  isIngelogd: boolean
  laden: boolean
  login: (email: string, wachtwoord: string) => Promise<void>
  registreer: (naam: string, email: string, wachtwoord: string, uitnodigingscode: string) => Promise<void>
  logout: () => void
}

const AuthCtx = createContext<AuthContext | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [gebruiker, setGebruiker] = useState<Gebruiker | null>(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('recepten-token')
    if (!token) { setLaden(false); return }
    api.get<Gebruiker>('/auth/mij')
      .then(setGebruiker)
      .catch(() => localStorage.removeItem('recepten-token'))
      .finally(() => setLaden(false))
  }, [])

  async function login(email: string, wachtwoord: string) {
    const res = await api.post<{ token: string; gebruiker: Gebruiker }>('/auth/login', { email, wachtwoord })
    localStorage.setItem('recepten-token', res.token)
    setGebruiker(res.gebruiker)
  }

  async function registreer(naam: string, email: string, wachtwoord: string, uitnodigingscode: string) {
    const res = await api.post<{ token: string; gebruiker: Gebruiker }>('/auth/registreer', { naam, email, wachtwoord, uitnodigingscode })
    localStorage.setItem('recepten-token', res.token)
    setGebruiker(res.gebruiker)
  }

  function logout() {
    localStorage.removeItem('recepten-token')
    setGebruiker(null)
  }

  return (
    <AuthCtx.Provider value={{ gebruiker, isIngelogd: !!gebruiker, laden, login, registreer, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
