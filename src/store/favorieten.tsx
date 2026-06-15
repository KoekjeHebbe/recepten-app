import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../api/client'
import { useAuth } from './auth'

const STORAGE_KEY = 'recepten-favorieten'

interface FavorietenContext {
  favorieten: string[]
  toggleFavoriet: (id: string) => void
  isFavoriet: (id: string) => boolean
}

const FavorietenCtx = createContext<FavorietenContext | null>(null)

export function FavorietenProvider({ children }: { children: ReactNode }) {
  const { isIngelogd } = useAuth()
  const [favorieten, setFavorieten] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    } catch { return [] }
  })

  // Laad favorieten van API als ingelogd
  useEffect(() => {
    if (!isIngelogd) return
    api.get<string[]>('/favorieten')
      .then(ids => {
        setFavorieten(ids)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
      })
      .catch(() => {/* gebruik localStorage als fallback */})
  }, [isIngelogd])

  // Bij uitloggen/sessie-verloop: per-gebruiker favorieten wissen zodat een
  // volgende (anonieme) bezoeker niet de favorieten van de vorige gebruiker ziet
  useEffect(() => {
    const handler = () => {
      setFavorieten([])
      localStorage.removeItem(STORAGE_KEY)
    }
    window.addEventListener('auth:uitgelogd', handler)
    return () => window.removeEventListener('auth:uitgelogd', handler)
  }, [])

  function toggleFavoriet(id: string) {
    setFavorieten(prev => {
      const isAl = prev.includes(id)
      const nieuw = isAl ? prev.filter(f => f !== id) : [...prev, id]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nieuw))
      if (isIngelogd) {
        const verzoek = isAl
          ? api.delete(`/favorieten/${id}`)
          : api.post('/favorieten', { recept_id: id })
        verzoek.catch(console.error)
      }
      return nieuw
    })
  }

  function isFavoriet(id: string) {
    return favorieten.includes(id)
  }

  return (
    <FavorietenCtx.Provider value={{ favorieten, toggleFavoriet, isFavoriet }}>
      {children}
    </FavorietenCtx.Provider>
  )
}

export function useFavorieten() {
  const ctx = useContext(FavorietenCtx)
  if (!ctx) throw new Error('useFavorieten must be used inside FavorietenProvider')
  return ctx
}
