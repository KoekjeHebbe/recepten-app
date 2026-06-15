import { useState, useEffect } from 'react'

interface Props {
  src: string | null | undefined
  alt: string
  /** Gedeelde classes (bijv. afmetingen) op zowel de img als de fallback. */
  className?: string
  /** Enkel op de <img>. */
  imgClassName?: string
  /** Enkel op de fallback-box. */
  fallbackClassName?: string
  emoji?: string
  loading?: 'lazy' | 'eager'
}

/**
 * Afbeelding met fallback: toont een 🍽-placeholder wanneer er geen URL is
 * óf wanneer het laden mislukt (dode/404-link). Lost het ontbrekende
 * onError-gedrag op zodat externe recept-URL's die rotten netjes degraderen.
 */
export default function Afbeelding({
  src, alt, className = '', imgClassName = '', fallbackClassName = '', emoji = '🍽', loading = 'lazy',
}: Props) {
  const [mislukt, setMislukt] = useState(false)
  // Reset bij wisselende bron (bijv. ander recept hergebruikt dezelfde component)
  useEffect(() => { setMislukt(false) }, [src])

  if (!src || mislukt) {
    return (
      <div
        className={`${className} ${fallbackClassName} bg-olive-50 flex items-center justify-center text-olive-200`}
        aria-hidden="true"
      >
        {emoji}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setMislukt(true)}
      className={`${className} ${imgClassName}`}
    />
  )
}
