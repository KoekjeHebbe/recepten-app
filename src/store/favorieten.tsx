import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const STORAGE_KEY = 'recepten-favorieten'

interface FavorietenContext {
  favorieten: string[]
  toggleFavoriet: (id: string) => void
  isFavoriet: (id: string) => boolean
}

const FavorietenCtx = createContext<FavorietenContext | null>(null)

export function FavorietenProvider({ children }: { children: ReactNode }) {
  const [favorieten, setFavorieten] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorieten))
  }, [favorieten])

  function toggleFavoriet(id: string) {
    setFavorieten(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
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
