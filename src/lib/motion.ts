// Geeft true als de gebruiker "verminder beweging" heeft ingesteld.
// Gebruikt om GSAP-animaties over te slaan (CSS-transitions worden al via
// een media query in index.css uitgeschakeld).
export function verminderBeweging(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
