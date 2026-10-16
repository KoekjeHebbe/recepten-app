import { useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * Bladwijzer "TNP → Recept" voor sites die onze server blokkeren (bv. HelloFresh).
 * Draait op de receptpagina zelf: pakt het JSON-LD-recept en opent de app met de
 * gegevens in het #-deel van de URL (dat gaat niet naar een server). De app doet
 * daarna de gewone import met de eigen login.
 */
export function bladwijzerCode(appUrl: string): string {
  const js = `(function(){` +
    `var vind=function(o){if(!o)return null;if(Array.isArray(o)){for(var i=0;i<o.length;i++){var r=vind(o[i]);if(r)return r}return null}` +
    `if(o['@graph'])return vind(o['@graph']);var t=o['@type'];if(t==='Recipe'||(Array.isArray(t)&&t.indexOf('Recipe')>-1))return o;return null};` +
    `var r=null,s=document.querySelectorAll('script[type="application/ld+json"]');` +
    `for(var i=0;i<s.length&&!r;i++){try{r=vind(JSON.parse(s[i].textContent))}catch(e){}}` +
    `if(!r){alert('Geen receptgegevens gevonden op deze pagina. Probeer in de app: Tekst plakken.');return}` +
    `var m={};['@type','name','image','recipeYield','recipeIngredient','recipeInstructions','nutrition'].forEach(function(k){if(r[k]!==undefined)m[k]=r[k]});` +
    // Geen letterlijke '#': in een javascript:-URL kan die als fragment-scheiding gelden.
    `window.open('${appUrl}'+String.fromCharCode(35)+'tnp-import='+encodeURIComponent(JSON.stringify({url:location.href,recept:m})),'_blank')` +
    `})()`
  return 'javascript:' + js
}

export default function ReceptBladwijzer() {
  const [open, setOpen] = useState(false)
  const [gekopieerd, setGekopieerd] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const code = bladwijzerCode(`${window.location.origin}${import.meta.env.BASE_URL}`)

  // React waarschuwt bij javascript:-URL's in JSX; daarom via het DOM zetten.
  useEffect(() => {
    if (open && linkRef.current) linkRef.current.setAttribute('href', code)
  }, [open, code])

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(code)
      setGekopieerd(true)
      setTimeout(() => setGekopieerd(false), 2500)
    } catch { /* knop blijft zichtbaar; slepen werkt ook */ }
  }

  return (
    <div className="mt-3 text-xs text-olive-700/60">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="underline underline-offset-2 hover:text-olive-700 py-1">
        Site blokkeert de import (zoals HelloFresh)?
      </button>
      {open && (
        <div className="mt-2 rounded-2xl bg-cream border border-olive-700/8 p-3 space-y-2">
          <p>
            Sleep deze knop één keer naar je bladwijzerbalk. Open daarna het recept op de site en klik op de
            bladwijzer: de app opent met het recept ingevuld.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a ref={linkRef} onClick={e => e.preventDefault()} draggable
              className="btn btn-primary btn-sm cursor-grab" title="Sleep mij naar je bladwijzerbalk">
              TNP → Recept
            </a>
            <button type="button" onClick={kopieer} className="btn btn-outline btn-sm">
              {gekopieerd ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              {gekopieerd ? 'Gekopieerd' : 'Kopieer code'}
            </button>
          </div>
          <p className="text-olive-700/50">Lukt het niet? Kies "Tekst plakken" en plak de hele receptpagina (Ctrl+A, Ctrl+C).</p>
        </div>
      )}
    </div>
  )
}
