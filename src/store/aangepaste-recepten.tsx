import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react'
import type { Recept } from '../types'
import receptenData from '../data/recepten.json'

const STORAGE_KEY = 'recepten-aangepast'
const jsonRecepten = receptenData as Recept[]

interface AangepasteReceptenContext {
  aangepasteRecepten: Recept[]
  alleRecepten: Recept[]
  voegReceptToe: (recept: Recept) => void
  verwijderRecept: (id: string) => void
}

const AangepasteReceptenCtx = createContext<AangepasteReceptenContext | null>(null)

export function maakId(titel: string): string {
  return titel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    + '-' + Date.now()
}

export function AangepasteReceptenProvider({ children }: { children: ReactNode }) {
  const [aangepasteRecepten, setAangepasteRecepten] = useState<Recept[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(aangepasteRecepten))
  }, [aangepasteRecepten])

  const alleRecepten = useMemo(
    () => [...aangepasteRecepten, ...jsonRecepten],
    [aangepasteRecepten]
  )

  function voegReceptToe(recept: Recept) {
    setAangepasteRecepten(prev => [recept, ...prev])
  }

  function verwijderRecept(id: string) {
    setAangepasteRecepten(prev => prev.filter(r => r.id !== id))
  }

  return (
    <AangepasteReceptenCtx.Provider value={{ aangepasteRecepten, alleRecepten, voegReceptToe, verwijderRecept }}>
      {children}
    </AangepasteReceptenCtx.Provider>
  )
}

export function useRecepten() {
  const ctx = useContext(AangepasteReceptenCtx)
  if (!ctx) throw new Error('useRecepten must be used inside AangepasteReceptenProvider')
  return ctx
}
