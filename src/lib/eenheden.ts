export type Eenheid =
  | 'g' | 'kg'
  | 'ml' | 'l' | 'el' | 'tl' | 'kl' | 'cup'
  | 'stuk' | 'teen' | 'plak' | 'sneetje' | 'handvol' | 'snufje'
  | ''

export const EENHEID_GROEPEN: { label: string; eenheden: Eenheid[] }[] = [
  { label: 'Gewicht', eenheden: ['g', 'kg'] },
  { label: 'Volume',  eenheden: ['ml', 'l', 'el', 'tl', 'kl', 'cup'] },
  { label: 'Stuk',    eenheden: ['stuk', 'teen', 'plak', 'sneetje', 'handvol', 'snufje'] },
  { label: 'Vrij',    eenheden: [''] },
]

// Alle eenheden gegroepeerd op canonieke eenheid (voor caching en conversie)
// g/kg → canonical 'g', volume-eenheden → canonical 'ml', stuks → zichzelf
export const CANONICAL: Record<Eenheid, string> = {
  g: 'g',  kg: 'g',
  ml: 'ml', l: 'ml', el: 'ml', tl: 'ml', kl: 'ml', cup: 'ml',
  stuk: 'stuk', teen: 'teen', plak: 'plak',
  sneetje: 'sneetje', handvol: 'handvol', snufje: 'snufje',
  '': '',
}

// Conversiefactor naar canonieke eenheid (1 eenheid = X canonical units)
export const NAAR_CANONICAL: Record<Eenheid, number> = {
  g: 1,    kg: 1000,
  ml: 1,   l: 1000, el: 15, tl: 5, kl: 2.5, cup: 240,
  stuk: 1, teen: 1, plak: 1, sneetje: 1, handvol: 1, snufje: 1,
  '': 1,
}

// Conversiefactor tussen twee eenheden met dezelfde canonical basis
export function converteer(
  waarde: number,
  van: Eenheid,
  naar: Eenheid
): number | null {
  if (CANONICAL[van] !== CANONICAL[naar] || CANONICAL[van] === '') return null
  return (waarde * NAAR_CANONICAL[van]) / NAAR_CANONICAL[naar]
}

// Stapgrootte voor +/- knoppen
export const STAP: Record<Eenheid, number> = {
  g: 10,    kg: 0.05,
  ml: 10,   l: 0.05, el: 0.5, tl: 0.25, kl: 0.25, cup: 0.25,
  stuk: 1,  teen: 1, plak: 1, sneetje: 1, handvol: 0.5, snufje: 0.5,
  '': 1,
}

// Formatteer getal zonder overbodige decimalen
export function formateerGetal(n: number): string {
  const r = Math.round(n * 100) / 100
  if (Number.isInteger(r)) return String(r)
  return r.toFixed(r < 1 ? 2 : 1).replace('.', ',')
}

// Formatteer "200 g", "1,5 el", "2 stuks", …
export function formateerHoeveelheid(hoeveelheid: number | null, eenheid: Eenheid | string): string {
  if (hoeveelheid === null || hoeveelheid === undefined) return ''
  const getal = formateerGetal(hoeveelheid)
  return eenheid ? `${getal} ${eenheid}` : getal
}

// Parseer een oude hoeveelheid-string ("200g", "2 el", "1,5 kg") naar number + eenheid
export function parseerOudeHoeveelheid(str: string | null): { hoeveelheid: number | null; eenheid: Eenheid } {
  if (!str) return { hoeveelheid: null, eenheid: '' }
  const s = str.trim()
  const eenheidVolgorde: Eenheid[] = [
    'sneetje', 'handvol', 'snufje', 'stuk', 'teen', 'plak',
    'cup', 'kg', 'kl', 'el', 'tl', 'ml', 'l', 'g',
  ]
  const re = new RegExp(
    `^([\\d]+(?:[.,][\\d]+)?)\\s*(${eenheidVolgorde.join('|')})?\\s*$`,
    'i'
  )
  const m = s.match(re)
  if (m) {
    const getal = parseFloat(m[1].replace(',', '.'))
    const eenheid = (m[2]?.toLowerCase() ?? 'stuk') as Eenheid
    return { hoeveelheid: getal, eenheid }
  }
  return { hoeveelheid: null, eenheid: '' }
}
