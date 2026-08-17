/**
 * Client-side afbeeldingscompressie via canvas.
 * Verkleint naar maxDim (langste zijde) en codeert als JPEG — vóór upload,
 * zodat een 12MP telefoonfoto niet als 6 MB de lijn over gaat.
 */
export async function comprimeerAfbeelding(
  file: File,
  maxDim = 1600,
  kwaliteit = 0.82
): Promise<{ base64: string; mediaType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Kon het bestand niet lezen.'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Kon de afbeelding niet openen.'))
    el.src = dataUrl
  })

  const schaal = Math.min(1, maxDim / Math.max(img.width, img.height))
  const breedte = Math.max(1, Math.round(img.width * schaal))
  const hoogte = Math.max(1, Math.round(img.height * schaal))

  // Al klein en al JPEG? Dan is hercoderen zinloos.
  if (schaal === 1 && file.type === 'image/jpeg' && file.size < 400_000) {
    return { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' }
  }

  const canvas = document.createElement('canvas')
  canvas.width = breedte
  canvas.height = hoogte
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas niet beschikbaar in deze browser.')
  // Witte achtergrond zodat transparante PNG's geen zwart vlak worden in JPEG
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, breedte, hoogte)
  ctx.drawImage(img, 0, 0, breedte, hoogte)

  const uit = canvas.toDataURL('image/jpeg', kwaliteit)
  return { base64: uit.split(',')[1], mediaType: 'image/jpeg' }
}
