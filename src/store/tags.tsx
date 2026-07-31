import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { api } from '../api/client'

export interface TagOptie {
  id: number
  naam: string
  gebruikt: number
}

interface TagsContext {
  maaltijden: TagOptie[]
  tags: TagOptie[]
  laden: boolean
  voegToe: (naam: string, soort: 'maaltijd' | 'tag') => Promise<void>
  verwijder: (id: number) => Promise<void>
  herlaad: () => Promise<void>
}

const TagsCtx = createContext<TagsContext | null>(null)

// Fallback zodat de app blijft werken als /api/tags (nog) niet bereikbaar is
const FALLBACK_MAALTIJDEN = ['diner', 'lunch', 'bijgerecht', 'tapas', 'ontbijt', 'snack', 'dessert']
const FALLBACK_TAGS = ['kip', 'kalkoen', 'rund', 'kalf', 'varken', 'lamsvlees', 'konijn', 'vis', 'garnalen',
  'vegetarisch', 'vegan', 'pasta', 'rijst', 'soep', 'salade', 'wrap', 'flatbread', 'gemengd_gehakt', 'low_carb', 'snel']
const alsOpties = (namen: string[]): TagOptie[] => namen.map((naam, i) => ({ id: -(i + 1), naam, gebruikt: 0 }))

export function TagsProvider({ children }: { children: ReactNode }) {
  const [maaltijden, setMaaltijden] = useState<TagOptie[]>(alsOpties(FALLBACK_MAALTIJDEN))
  const [tags, setTags] = useState<TagOptie[]>(alsOpties(FALLBACK_TAGS))
  const [laden, setLaden] = useState(true)

  const herlaad = useCallback(async () => {
    try {
      const res = await api.get<{ maaltijd: TagOptie[]; tag: TagOptie[] }>('/tags')
      if (res.maaltijd?.length) setMaaltijden(res.maaltijd)
      if (res.tag?.length) setTags(res.tag)
    } catch {
      /* fallback-lijst blijft staan */
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => { herlaad() }, [herlaad])

  async function voegToe(naam: string, soort: 'maaltijd' | 'tag') {
    await api.post('/tags', { naam, soort })
    await herlaad()
  }

  async function verwijder(id: number) {
    await api.delete(`/tags/${id}`)
    await herlaad()
  }

  return (
    <TagsCtx.Provider value={{ maaltijden, tags, laden, voegToe, verwijder, herlaad }}>
      {children}
    </TagsCtx.Provider>
  )
}

export function useTags() {
  const ctx = useContext(TagsCtx)
  if (!ctx) throw new Error('useTags must be used inside TagsProvider')
  return ctx
}
