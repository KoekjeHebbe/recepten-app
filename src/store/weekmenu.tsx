import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import type { WeekMenu, Dag } from '../types'
import { DAGEN } from '../types'
import { api } from '../api/client'
import { useAuth } from './auth'
import { useRecepten } from './aangepaste-recepten'

const OUDE_LOCALSTORAGE_KEY = 'recepten-weekmenu'
const SYNC_DEBOUNCE_MS = 500

function emptyMenu(): WeekMenu {
  const menu: WeekMenu = {}
  DAGEN.forEach(dag => { menu[dag] = [] })
  return menu
}

function isLeegMenu(m: WeekMenu): boolean {
  return DAGEN.every(d => !m[d] || m[d].length === 0)
}

interface WeekMenuContext {
  menu: WeekMenu
  laden: boolean
  addToDay: (dag: Dag, recept_id: string, porties?: number) => void
  setPorties: (dag: Dag, recept_id: string, porties: number) => void
  removeFromDay: (dag: Dag, recept_id: string) => void
  clearDay: (dag: Dag) => void
  clearAll: () => void
}

const WeekMenuCtx = createContext<WeekMenuContext | null>(null)

export function WeekMenuProvider({ children }: { children: ReactNode }) {
  const { isIngelogd } = useAuth()
  const { alleRecepten, laden: receptenLaden } = useRecepten()

  const [menu, setMenu]       = useState<WeekMenu>(emptyMenu())
  const [laden, setLaden]     = useState(true)
  const [hydrated, setHydrated] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleSync(nieuw: WeekMenu) {
    if (!isIngelogd) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      api.put('/weekmenu', { menu: nieuw }).catch(e => {
        console.error('Kon weekmenu niet syncen', e)
      })
    }, SYNC_DEBOUNCE_MS)
  }

  // Hydratie van server bij login
  useEffect(() => {
    if (!isIngelogd) {
      setMenu(emptyMenu())
      setHydrated(false)
      setLaden(false)
      return
    }
    setLaden(true)
    let cancelled = false
    api.get<{ menu: WeekMenu }>('/weekmenu')
      .then(data => {
        if (cancelled) return
        const fresh = emptyMenu()
        for (const d of DAGEN) {
          fresh[d] = Array.isArray(data.menu?.[d]) ? data.menu[d] : []
        }
        setMenu(fresh)
        setHydrated(true)
        setLaden(false)
      })
      .catch(e => {
        if (cancelled) return
        console.error('Kon weekmenu niet ophalen', e)
        setLaden(false)
      })
    return () => { cancelled = true }
  }, [isIngelogd])

  // Eenmalige localStorage → server migratie nadat zowel server-state
  // als recepten geladen zijn.
  useEffect(() => {
    if (!isIngelogd || !hydrated || receptenLaden) return
    const ruwe = localStorage.getItem(OUDE_LOCALSTORAGE_KEY)
    if (!ruwe) return

    // Server heeft al data → oude key droppen, niet overschrijven.
    if (!isLeegMenu(menu)) {
      localStorage.removeItem(OUDE_LOCALSTORAGE_KEY)
      return
    }

    try {
      const oud = JSON.parse(ruwe)
      const nieuw = emptyMenu()
      for (const d of DAGEN) {
        const ids = oud?.[d]
        if (!Array.isArray(ids)) continue
        for (const id of ids) {
          if (typeof id !== 'string') continue
          const recept = alleRecepten.find(r => r.id === id)
          if (!recept) continue
          nieuw[d].push({ recept_id: id, porties: recept.personen })
        }
      }
      if (isLeegMenu(nieuw)) {
        localStorage.removeItem(OUDE_LOCALSTORAGE_KEY)
        return
      }
      setMenu(nieuw)
      api.put('/weekmenu', { menu: nieuw })
        .then(() => localStorage.removeItem(OUDE_LOCALSTORAGE_KEY))
        .catch(e => console.error('Migratie naar server mislukt', e))
    } catch {
      localStorage.removeItem(OUDE_LOCALSTORAGE_KEY)
    }
  }, [isIngelogd, hydrated, receptenLaden, alleRecepten, menu])

  function addToDay(dag: Dag, recept_id: string, porties?: number) {
    setMenu(prev => {
      if (prev[dag].some(it => it.recept_id === recept_id)) return prev
      const recept = alleRecepten.find(r => r.id === recept_id)
      const def = porties ?? recept?.personen ?? 1
      const nieuw: WeekMenu = { ...prev, [dag]: [...prev[dag], { recept_id, porties: def }] }
      scheduleSync(nieuw)
      return nieuw
    })
  }

  function setPorties(dag: Dag, recept_id: string, porties: number) {
    if (!Number.isFinite(porties) || porties <= 0) return
    setMenu(prev => {
      const nieuw: WeekMenu = {
        ...prev,
        [dag]: prev[dag].map(it => it.recept_id === recept_id ? { ...it, porties } : it),
      }
      scheduleSync(nieuw)
      return nieuw
    })
  }

  function removeFromDay(dag: Dag, recept_id: string) {
    setMenu(prev => {
      const nieuw: WeekMenu = { ...prev, [dag]: prev[dag].filter(it => it.recept_id !== recept_id) }
      scheduleSync(nieuw)
      return nieuw
    })
  }

  function clearDay(dag: Dag) {
    setMenu(prev => {
      const nieuw: WeekMenu = { ...prev, [dag]: [] }
      scheduleSync(nieuw)
      return nieuw
    })
  }

  function clearAll() {
    const nieuw = emptyMenu()
    setMenu(nieuw)
    scheduleSync(nieuw)
  }

  return (
    <WeekMenuCtx.Provider value={{ menu, laden, addToDay, setPorties, removeFromDay, clearDay, clearAll }}>
      {children}
    </WeekMenuCtx.Provider>
  )
}

export function useWeekMenu() {
  const ctx = useContext(WeekMenuCtx)
  if (!ctx) throw new Error('useWeekMenu must be used inside WeekMenuProvider')
  return ctx
}
