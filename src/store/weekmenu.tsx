import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { WeekMenu, Dag } from '../types'
import { DAGEN } from '../types'

const STORAGE_KEY = 'recepten-weekmenu'

function emptyMenu(): WeekMenu {
  const menu: WeekMenu = {}
  DAGEN.forEach(dag => { menu[dag] = [] })
  return menu
}

interface WeekMenuContext {
  menu: WeekMenu
  addToDay: (dag: Dag, receptId: string) => void
  removeFromDay: (dag: Dag, receptId: string) => void
  clearDay: (dag: Dag) => void
  clearAll: () => void
}

const WeekMenuCtx = createContext<WeekMenuContext | null>(null)

export function WeekMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<WeekMenu>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return { ...emptyMenu(), ...JSON.parse(saved) }
    } catch { /* ignore */ }
    return emptyMenu()
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(menu))
  }, [menu])

  function addToDay(dag: Dag, receptId: string) {
    setMenu(prev => ({
      ...prev,
      [dag]: prev[dag].includes(receptId) ? prev[dag] : [...prev[dag], receptId],
    }))
  }

  function removeFromDay(dag: Dag, receptId: string) {
    setMenu(prev => ({
      ...prev,
      [dag]: prev[dag].filter(id => id !== receptId),
    }))
  }

  function clearDay(dag: Dag) {
    setMenu(prev => ({ ...prev, [dag]: [] }))
  }

  function clearAll() {
    setMenu(emptyMenu())
  }

  return (
    <WeekMenuCtx.Provider value={{ menu, addToDay, removeFromDay, clearDay, clearAll }}>
      {children}
    </WeekMenuCtx.Provider>
  )
}

export function useWeekMenu() {
  const ctx = useContext(WeekMenuCtx)
  if (!ctx) throw new Error('useWeekMenu must be used inside WeekMenuProvider')
  return ctx
}
