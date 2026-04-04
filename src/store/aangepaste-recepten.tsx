import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Recept } from '../types'
import { api } from '../api/client'

interface ReceptenContext {
  alleRecepten: Recept[]
  laden: boolean
  voegReceptToe: (recept: Recept) => Promise<Recept>
  updateRecept: (recept: Recept) => Promise<void>
  verwijderRecept: (id: string) => Promise<void>
  herlaad: () => Promise<void>
}

const ReceptenCtx = createContext<ReceptenContext | null>(null)

export function maakId(titel: string): string {
  return titel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function AangepasteReceptenProvider({ children }: { children: ReactNode }) {
  const [alleRecepten, setAlleRecepten] = useState<Recept[]>([])
  const [laden, setLaden] = useState(true)

  async function laadRecepten() {
    try {
      const data = await api.get<Recept[]>('/recepten')
      setAlleRecepten(data)
    } catch (e) {
      console.error('Kon recepten niet laden', e)
    } finally {
      setLaden(false)
    }
  }

  useEffect(() => { laadRecepten() }, [])

  async function voegReceptToe(recept: Recept): Promise<Recept> {
    const nieuw = await api.post<Recept>('/recepten', recept)
    setAlleRecepten(prev => [nieuw, ...prev])
    return nieuw
  }

  async function updateRecept(recept: Recept): Promise<void> {
    const bijgewerkt = await api.put<Recept>(`/recepten/${recept.id}`, recept)
    setAlleRecepten(prev => prev.map(r => r.id === recept.id ? bijgewerkt : r))
  }

  async function verwijderRecept(id: string): Promise<void> {
    await api.delete(`/recepten/${id}`)
    setAlleRecepten(prev => prev.filter(r => r.id !== id))
  }

  return (
    <ReceptenCtx.Provider value={{ alleRecepten, laden, voegReceptToe, updateRecept, verwijderRecept, herlaad: laadRecepten }}>
      {children}
    </ReceptenCtx.Provider>
  )
}

export function useRecepten() {
  const ctx = useContext(ReceptenCtx)
  if (!ctx) throw new Error('useRecepten must be used inside AangepasteReceptenProvider')
  return ctx
}
