import { useEffect } from 'react'
import type { RefObject } from 'react'

/** Roept onBuiten aan bij een klik buiten het element (enkel als actief). */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  actief: boolean,
  onBuiten: () => void
) {
  useEffect(() => {
    if (!actief) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onBuiten()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [actief, ref, onBuiten])
}
