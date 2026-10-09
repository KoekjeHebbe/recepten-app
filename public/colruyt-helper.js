/*
 * TNP → Colruyt Xtra-lijst
 * Wordt via een bladwijzer op www.colruyt.be geladen. Draait volledig in de
 * browser van de gebruiker (met diens eigen Colruyt-login): haalt de
 * boodschappenlijst uit de recepten-app, zoekt per ingrediënt een product,
 * en zet de gekozen producten op de Xtra-boodschappenlijst.
 */
(function () {
  'use strict'

  var API = 'https://thenextprepisode.minglemurders.com/api/colruyt'
  var ZOEK_URL = 'https://apip.colruyt.be/gateway/emec.colruyt.protected.bffsvc/cg/nl/api/product-search-prs'
  var BFF = 'https://apix.colruyt.be/gateway/emec.colruyt.bffsvc/cg'
  // Publieke sleutel die de Colruyt-website zelf meestuurt; overschrijfbaar als Colruyt hem wijzigt.
  var APIKEY = lees('tnp-colruyt-apikey') || 'a8ylmv13-b285-4788-9e14-0f79b7ed2411'

  var script = document.currentScript
  var sleutel = (script && (script.dataset.k || new URL(script.src).searchParams.get('k'))) || ''

  if (!/(^|\.)colruyt\.be$/.test(location.hostname)) {
    alert('Open eerst www.colruyt.be (en log in), en klik dan opnieuw op de bladwijzer.')
    return
  }
  if (window.__tnpColruyt) { window.__tnpColruyt.toon(); return }

  function lees(k) { try { return localStorage.getItem(k) } catch (e) { return null } }
  function schrijf(k, v) { try { localStorage.setItem(k, v) } catch (e) { /* privémodus */ } }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  // ── Winkel (placeId) ─────────────────────────────────────────────────────
  function zoekPlaceId() {
    var bewaard = lees('tnp-colruyt-place')
    if (bewaard) return bewaard
    var bronnen = []
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); bronnen.push(k + '=' + localStorage.getItem(k)) } } catch (e) {}
    try { for (var j = 0; j < sessionStorage.length; j++) { var s = sessionStorage.key(j); bronnen.push(s + '=' + sessionStorage.getItem(s)) } } catch (e) {}
    bronnen = bronnen.concat(document.cookie.split(/;\s*/).map(decodeURIComponent))
    for (var b = 0; b < bronnen.length; b++) {
      var m = /place[_-]?id"?\s*[:=]\s*"?(\d{2,6})\b/i.exec(bronnen[b])
      if (m) return m[1]
    }
    return ''
  }
  var placeId = zoekPlaceId()

  // ── Hoeveelheden ─────────────────────────────────────────────────────────
  var NAAR_BASIS = { g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], el: ['ml', 15], tl: ['ml', 5], kl: ['ml', 2.5], cup: ['ml', 240] }

  function nodig(hoeveelheden) {
    var uit = { g: 0, ml: 0, stuk: 0 }
    ;(hoeveelheden || []).forEach(function (h) {
      var b = NAAR_BASIS[h.eenheid]
      if (b) uit[b[0]] += h.hoeveelheid * b[1]
      else uit.stuk += h.hoeveelheid
    })
    return uit
  }

  // "500g", "1kg", "6x1,5L", "4 st", "ca. 600 g" → { hoeveelheid, eenheid: g|ml|stuk }
  function parseInhoud(tekst) {
    var m = /(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|gr|g|cl|ml|l|st|stuks?)\b/i.exec(tekst || '')
    if (!m) return null
    var aantal = m[1] ? parseInt(m[1], 10) : 1
    var n = parseFloat(m[2].replace(',', '.')) * aantal
    var e = m[3].toLowerCase()
    if (e === 'kg') return { hoeveelheid: n * 1000, eenheid: 'g' }
    if (e === 'g' || e === 'gr') return { hoeveelheid: n, eenheid: 'g' }
    if (e === 'l') return { hoeveelheid: n * 1000, eenheid: 'ml' }
    if (e === 'cl') return { hoeveelheid: n * 10, eenheid: 'ml' }
    if (e === 'ml') return { hoeveelheid: n, eenheid: 'ml' }
    return { hoeveelheid: n, eenheid: 'stuk' }
  }

  function aantalPakken(item, product) {
    var n = nodig(item.hoeveelheden)
    var inh = parseInhoud(product && (product.content || product.inhoud))
    var p = 1
    if (inh && inh.eenheid === 'stuk' && n.stuk > 0) p = Math.ceil(n.stuk / inh.hoeveelheid)
    else if (inh && inh.eenheid !== 'stuk') {
      // g en ml als ongeveer gelijk beschouwen (water, melk, room, …)
      var gewicht = n.g + n.ml
      if (gewicht > 0) p = Math.ceil(gewicht / inh.hoeveelheid - 0.05)
    } else if (n.stuk > 0 && !inh) p = Math.ceil(n.stuk)
    return Math.max(1, Math.min(20, p || 1))
  }

  function formatNodig(item) {
    return (item.hoeveelheden || []).map(function (h) {
      var g = Math.round(h.hoeveelheid * 100) / 100
      return String(g).replace('.', ',') + (h.eenheid ? ' ' + h.eenheid : '')
    }).join(' + ')
  }

  // ── Colruyt-aanroepen (met de sessie van de gebruiker) ───────────────────
  function colruytFetch(url, opties) {
    opties = opties || {}
    opties.credentials = 'include'
    opties.headers = Object.assign({ 'x-cg-apikey': APIKEY, Accept: 'application/json' }, opties.headers || {})
    return fetch(url, opties).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error('niet-ingelogd')
      if (!r.ok) {
        return r.text().then(function (tekst) {
          var detail = tekst
          try {
            var j = JSON.parse(tekst)
            detail = j.message || j.error || j.detail || (j.errors && JSON.stringify(j.errors)) || tekst
          } catch (e) { /* geen JSON */ }
          var err = new Error('Colruyt antwoordde met ' + r.status + (detail ? ': ' + String(detail).slice(0, 200) : ''))
          err.status = r.status
          throw err
        })
      }
      return r.status === 204 ? null : r.json().catch(function () { return null })
    })
  }

  function zoekProducten(term) {
    var q = new URLSearchParams({ searchTerm: term, size: '8', sort: 'relevancy desc', isAvailable: 'true', skip: '0' })
    if (placeId) q.set('placeId', placeId)
    return colruytFetch(ZOEK_URL + '?' + q.toString()).then(function (d) { return (d && d.products) || [] })
  }

  function meestGekocht() {
    if (!placeId) return Promise.resolve([])
    var q = new URLSearchParams({ lang: 'nl', placeId: placeId, prs: 'true' })
    return colruytFetch(BFF + '/most-bought-products?' + q.toString()).then(function (d) { return Array.isArray(d) ? d : [] })
  }

  function zoekterm(naam) {
    return naam.split(',')[0].replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  }

  // ── UI (Shadow DOM, zodat de Colruyt-stijlen er niet aan zitten) ──────────
  var host = document.createElement('div')
  host.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483647;height:100vh;width:min(480px,100vw)'
  var root = host.attachShadow({ mode: 'open' })
  document.body.appendChild(host)

  root.innerHTML = '<style>' +
    ':host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,sans-serif}' +
    '.paneel{height:100%;overflow-y:auto;background:#F2F0E9;color:#2E4036;box-shadow:-8px 0 30px rgba(0,0,0,.18);border-left:1px solid rgba(46,64,54,.12);font-size:14px}' +
    '.kop{position:sticky;top:0;background:#F2F0E9;padding:16px 18px 12px;border-bottom:1px solid rgba(46,64,54,.1);z-index:2}' +
    '.kop h1{font:700 19px Georgia,serif;margin:0 0 4px}.sub{font-size:12px;color:rgba(46,64,54,.65);margin:0}' +
    '.sluit{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(46,64,54,.15);background:#fff;cursor:pointer;font-size:16px}' +
    '.inst{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:12px}.inst input{width:90px;padding:6px 8px;border-radius:10px;border:1px solid rgba(46,64,54,.2)}' +
    '.lijst{padding:12px 14px 120px}.item{background:#fff;border-radius:18px;border:1px solid rgba(46,64,54,.08);padding:12px;margin-bottom:10px}' +
    '.item.uit{opacity:.5}.ihead{display:flex;align-items:center;gap:8px}.ihead b{flex:1;font-size:14px}.nodig{font-size:12px;color:rgba(46,64,54,.6)}' +
    '.opties{margin-top:8px;display:flex;flex-direction:column;gap:6px}' +
    'label.opt{display:flex;gap:8px;align-items:center;padding:6px;border-radius:12px;border:1px solid transparent;cursor:pointer}' +
    'label.opt:hover{background:#F7F5EF}label.opt.gekozen{border-color:#CC5833;background:#FBF1EC}' +
    '.opt img{width:40px;height:40px;object-fit:contain;border-radius:8px;background:#fff;flex-shrink:0}.opt .t{flex:1;font-size:12.5px;line-height:1.3}' +
    '.opt .prijs{font-size:12px;font-weight:600;white-space:nowrap}.badge{display:inline-block;font-size:10px;font-weight:700;padding:1px 6px;border-radius:99px;background:#2E4036;color:#F2F0E9;margin-left:4px}' +
    '.rij{display:flex;gap:8px;align-items:center;margin-top:8px;font-size:12px}.rij input[type=number]{width:56px;padding:5px;border-radius:10px;border:1px solid rgba(46,64,54,.2)}' +
    '.rij input[type=search]{flex:1;min-width:0;padding:6px 10px;border-radius:10px;border:1px solid rgba(46,64,54,.2)}' +
    '.knop{border:0;border-radius:99px;padding:12px 18px;font-weight:700;cursor:pointer;background:#CC5833;color:#fff;font-size:14px}.knop:disabled{opacity:.5;cursor:default}' +
    '.klein{border:1px solid rgba(46,64,54,.2);background:#fff;color:#2E4036;border-radius:99px;padding:5px 10px;font-size:12px;cursor:pointer}' +
    '.voet{position:fixed;bottom:0;right:0;width:min(480px,100vw);padding:14px 16px;background:#F2F0E9;border-top:1px solid rgba(46,64,54,.1);display:flex;gap:10px;align-items:center}' +
    '.voet .info{flex:1;font-size:12px;color:rgba(46,64,54,.7)}.melding{margin:10px 14px;padding:10px 12px;border-radius:14px;font-size:13px;background:#fff;border:1px solid rgba(46,64,54,.1)}' +
    '.melding.fout{background:#FBEDE7;border-color:#E9B8A5;color:#8A3A1F}.melding.ok{background:#EEF3EC;border-color:#BFD1BA}' +
    'h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(46,64,54,.55);margin:16px 4px 8px}' +
    '</style>' +
    '<div class="paneel"><div class="kop"><button class="sluit" title="Sluiten">✕</button>' +
    '<h1>Naar je Xtra-lijst</h1><p class="sub" id="status">Lijst laden…</p>' +
    '<div class="inst">Winkel-ID <input id="place" inputmode="numeric" placeholder="bv. 2643"><span class="sub">je Collect&amp;Go-winkel</span></div></div>' +
    '<div id="meldingen"></div><div class="lijst" id="lijst"></div></div>' +
    '<div class="voet"><span class="info" id="teller"></span><button class="knop" id="voegtoe" disabled>Zet op mijn lijst</button></div>'

  var $ = function (sel) { return root.querySelector(sel) }
  $('.sluit').onclick = function () { host.style.display = 'none' }
  $('#place').value = placeId
  $('#place').onchange = function () {
    placeId = this.value.trim()
    schrijf('tnp-colruyt-place', placeId)
    start()
  }
  window.__tnpColruyt = { toon: function () { host.style.display = '' } }

  function melding(tekst, soort) {
    var d = document.createElement('div')
    d.className = 'melding ' + (soort || '')
    d.textContent = tekst
    $('#meldingen').appendChild(d)
    return d
  }

  // ── Staat ────────────────────────────────────────────────────────────────
  var items = []        // { naam, hoeveelheden, voorraadkast, mee, opties[], gekozen, aantal }
  var koppelingen = {}
  var gekocht = {}      // technicalArticleNumber → true

  function productUitKoppeling(p) {
    return { technicalArticleNumber: p.id, LongName: p.naam, brand: p.merk, content: p.inhoud, thumbNail: p.afbeelding, GTIN: p.gtin, _gekoppeld: true }
  }

  function kiesStandaard(item) {
    var opties = item.opties
    var k = koppelingen[item.naam.toLowerCase()]
    if (k) {
      var bestaand = opties.filter(function (o) { return o.technicalArticleNumber === k.id })[0]
      if (bestaand) bestaand._gekoppeld = true
      else opties.unshift(productUitKoppeling(k))
    }
    opties.sort(function (a, b) {
      var sa = (a._gekoppeld ? 2 : 0) + (gekocht[a.technicalArticleNumber] ? 1 : 0)
      var sb = (b._gekoppeld ? 2 : 0) + (gekocht[b.technicalArticleNumber] ? 1 : 0)
      return sb - sa
    })
    item.gekozen = opties.length ? opties[0].technicalArticleNumber : null
    item.aantal = aantalPakken(item, opties[0])
  }

  function render() {
    var html = ''
    var groepen = [['Boodschappen', items.filter(function (i) { return !i.voorraadkast })],
                   ['Voorraadkast (staat standaard uit)', items.filter(function (i) { return i.voorraadkast })]]
    groepen.forEach(function (g) {
      if (!g[1].length) return
      html += '<h2>' + esc(g[0]) + '</h2>'
      g[1].forEach(function (it) {
        var idx = items.indexOf(it)
        html += '<div class="item' + (it.mee ? '' : ' uit') + '" data-i="' + idx + '">' +
          '<div class="ihead"><input type="checkbox" class="mee"' + (it.mee ? ' checked' : '') + ' title="Meenemen">' +
          '<b>' + esc(it.naam) + '</b><span class="nodig">' + esc(formatNodig(it)) + '</span></div>'
        if (it.mee) {
          if (it.laden) html += '<p class="sub" style="margin:8px 0 0">Zoeken…</p>'
          else if (!it.opties.length) html += '<p class="sub" style="margin:8px 0 0">Niets gevonden — probeer een andere zoekterm.</p>'
          else {
            html += '<div class="opties">' + it.opties.slice(0, 5).map(function (o) {
              var prijs = o.price && o.price.basicPrice != null ? '€ ' + o.price.basicPrice.toFixed(2).replace('.', ',') : ''
              var badges = (o._gekoppeld ? '<span class="badge">vorige keer</span>' : '') +
                (gekocht[o.technicalArticleNumber] && !o._gekoppeld ? '<span class="badge">vaak gekocht</span>' : '')
              return '<label class="opt' + (o.technicalArticleNumber === it.gekozen ? ' gekozen' : '') + '">' +
                '<input type="radio" name="k' + idx + '" value="' + esc(o.technicalArticleNumber) + '"' + (o.technicalArticleNumber === it.gekozen ? ' checked' : '') + ' hidden>' +
                (o.thumbNail ? '<img src="' + esc(o.thumbNail) + '" alt="">' : '<img alt="">') +
                '<span class="t">' + esc(o.LongName || ((o.brand ? o.brand + ' ' : '') + o.name)) + badges + '</span>' +
                '<span class="prijs">' + esc(prijs) + '</span></label>'
            }).join('') + '</div>'
          }
          html += '<div class="rij">Aantal <input type="number" class="aantal" min="1" max="50" value="' + it.aantal + '">' +
            '<input type="search" class="term" placeholder="Andere zoekterm…"><button class="klein zoek">Zoek</button></div>'
        }
        html += '</div>'
      })
    })
    $('#lijst').innerHTML = html
    var mee = items.filter(function (i) { return i.mee && i.gekozen })
    $('#teller').textContent = mee.length + ' van ' + items.length + ' producten gekozen'
    $('#voegtoe').disabled = !mee.length
    $('#voegtoe').textContent = 'Zet ' + mee.length + ' op mijn lijst'
  }

  $('#lijst').addEventListener('change', function (e) {
    var kaart = e.target.closest('.item'); if (!kaart) return
    var it = items[+kaart.dataset.i]
    if (e.target.classList.contains('mee')) {
      it.mee = e.target.checked
      if (it.mee && !it.gezocht) return zoekVoor(it)
    } else if (e.target.type === 'radio') {
      it.gekozen = e.target.value
      var p = it.opties.filter(function (o) { return o.technicalArticleNumber === it.gekozen })[0]
      it.aantal = aantalPakken(it, p)
    } else if (e.target.classList.contains('aantal')) {
      it.aantal = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1))
      return
    } else return
    render()
  })
  $('#lijst').addEventListener('click', function (e) {
    if (!e.target.classList.contains('zoek')) return
    var kaart = e.target.closest('.item')
    var it = items[+kaart.dataset.i]
    var term = kaart.querySelector('.term').value.trim()
    if (term) zoekVoor(it, term)
  })
  $('#lijst').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList.contains('term')) e.target.closest('.item').querySelector('.zoek').click()
  })

  function zoekVoor(it, term) {
    it.laden = true; it.gezocht = true; render()
    return zoekProducten(term || zoekterm(it.naam)).then(function (res) {
      it.opties = res
      kiesStandaard(it)
    }).catch(function (err) {
      it.opties = []
      if (err.message !== 'niet-ingelogd') melding('Zoeken naar "' + it.naam + '" mislukt: ' + err.message, 'fout')
    }).then(function () { it.laden = false; render() })
  }

  // Beleefd: max. 3 zoekopdrachten tegelijk
  function zoekAlles(lijst) {
    var i = 0
    function volgende() {
      if (i >= lijst.length) return Promise.resolve()
      var it = lijst[i++]
      return zoekVoor(it).then(volgende)
    }
    return Promise.all([volgende(), volgende(), volgende()])
  }

  // ── Toevoegen ────────────────────────────────────────────────────────────
  $('#voegtoe').onclick = function () {
    var knop = this
    var gekozen = items.filter(function (i) { return i.mee && i.gekozen }).map(function (it) {
      return { item: it, product: it.opties.filter(function (o) { return o.technicalArticleNumber === it.gekozen })[0] }
    })
    // Zelfde vorm als de Colruyt-site zelf verstuurt; 'eenvoudig' = 1 stuk, eenheid P.
    function lijstItem(g, eenvoudig) {
      var nu = new Date().toISOString()
      return {
        id: crypto.randomUUID(), createdAt: nu, updatedAt: nu, completedAt: null,
        description: (g.product.LongName || ((g.product.brand ? g.product.brand + ' ' : '') + (g.product.name || ''))).slice(0, 100),
        productData: {
          productId: String(g.product.technicalArticleNumber),
          quantity: eenvoudig ? 1 : Math.max(1, Math.round(g.item.aantal)),
          unitCode: eenvoudig ? 'P' : (g.product.OrderUnit || 'P'),
        },
      }
    }
    function stuur(lijst) {
      return colruytFetch(BFF + '/add-items-to-list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: lijst }) })
    }
    // Eén voor één, zodat één afgekeurd product de rest niet tegenhoudt.
    // Bij een weigering nog één poging als "1 stuk"; lukt dat, dan melden we het aangepaste aantal.
    function eenVoorEen() {
      var gelukt = [], aangepast = [], mislukt = []
      return gekozen.reduce(function (keten, g) {
        return keten.then(function () {
          return stuur([lijstItem(g, false)]).then(function () { gelukt.push(g) }, function (err) {
            if (err.message === 'niet-ingelogd') throw err
            return stuur([lijstItem(g, true)]).then(function () { gelukt.push(g); aangepast.push(g) }, function (err2) {
              if (err2.message === 'niet-ingelogd') throw err2
              mislukt.push({ g: g, reden: err2.message })
            })
          })
        })
      }, Promise.resolve()).then(function () { return { gelukt: gelukt, aangepast: aangepast, mislukt: mislukt } })
    }

    knop.disabled = true; knop.textContent = 'Bezig…'
    stuur(gekozen.map(function (g) { return lijstItem(g, false) }))
      .then(function () { return { gelukt: gekozen, aangepast: [], mislukt: [] } }, function (err) {
        if (err.message === 'niet-ingelogd' || (err.status && err.status >= 500)) throw err
        knop.textContent = 'Eén voor één…'
        return eenVoorEen()
      })
      .then(function (res) {
        if (res.gelukt.length) melding('✓ ' + res.gelukt.length + ' producten staan op je Xtra-boodschappenlijst.', 'ok')
        if (res.aangepast.length) melding('Bij ' + res.aangepast.length + ' product(en) aanvaardde Colruyt het aantal niet; die staan er als 1 stuk op — pas ze aan in je lijst: ' +
          res.aangepast.map(function (g) { return g.item.naam }).join(', '), 'fout')
        if (res.mislukt.length) melding('Niet gelukt voor ' + res.mislukt.length + ' product(en): ' +
          res.mislukt.map(function (m) { return m.g.item.naam }).join(', ') + '. ' + res.mislukt[0].reden, 'fout')
        // Vinkje weg bij wat gelukt is, zodat een tweede klik geen dubbels maakt
        res.gelukt.forEach(function (g) { g.item.mee = false })
        gekozen = res.gelukt
        if (!gekozen.length) return
        // Keuzes onthouden + macro's laten ophalen (fouten hier zijn niet erg)
        return fetch(API + '/koppelingen?k=' + encodeURIComponent(sleutel), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ koppelingen: gekozen.map(function (g) {
            var p = g.product
            return { ingredient: g.item.naam, product: {
              id: p.technicalArticleNumber, naam: p.LongName || p.name, merk: p.brand || '', inhoud: p.content || '',
              afbeelding: p.thumbNail || null, gtin: p.GTIN || [] } }
          }) }),
        }).then(function (r) { return r.json() }).then(function (d) {
          var res = (d && d.resultaat) || []
          var nieuw = res.filter(function (r) { return r.macros === 'bijgewerkt' })
          var recepten = nieuw.reduce(function (s, r) { return s + (r.recepten || 0) }, 0)
          if (nieuw.length) melding('Macro\'s van ' + nieuw.length + ' product(en) gevonden; ' + recepten + ' recept(en) bijgewerkt.', 'ok')
        }).catch(function () {})
      })
      .catch(function (err) {
        melding(err.message === 'niet-ingelogd'
          ? 'Je bent niet ingelogd op colruyt.be. Log in (rechtsboven) en klik opnieuw op de bladwijzer.'
          : 'Toevoegen mislukt: ' + err.message, 'fout')
      })
      .then(function () { knop.disabled = false; render() })
  }

  // ── Start ────────────────────────────────────────────────────────────────
  function start() {
    $('#meldingen').innerHTML = ''
    if (!sleutel) { $('#status').textContent = 'Deze bladwijzer mist je sleutel — maak hem opnieuw in de app.'; return }
    $('#status').textContent = 'Lijst laden…'
    Promise.all([
      fetch(API + '/lijst?k=' + encodeURIComponent(sleutel)).then(function (r) {
        return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || d.fout || r.status); return d })
      }),
      meestGekocht().catch(function (err) {
        if (err.message === 'niet-ingelogd') melding('Je bent niet ingelogd op colruyt.be: zoeken lukt, maar toevoegen aan je lijst niet.', 'fout')
        return []
      }),
    ]).then(function (res) {
      var data = res[0]
      koppelingen = data.koppelingen || {}
      gekocht = {}
      res[1].forEach(function (p) { if (p && p.technicalArticleNumber) gekocht[p.technicalArticleNumber] = true })
      items = (data.items || []).map(function (it) {
        var leidingwater = /^(koud|warm|heet|lauw|kokend)?\s*water$/i.test(it.naam.trim())
        return { naam: it.naam, hoeveelheden: it.hoeveelheden || [], voorraadkast: !!it.voorraadkast || leidingwater, mee: !it.voorraadkast && !leidingwater, opties: [], gekozen: null, aantal: 1 }
      })
      var wanneer = data.bijgewerkt_op ? ' (bijgewerkt ' + data.bijgewerkt_op.slice(0, 16).replace('T', ' ') + ')' : ''
      $('#status').textContent = items.length ? items.length + ' ingrediënten van je weekmenu' + wanneer : 'Je boodschappenlijst is leeg — open hem eerst in de app.'
      render()
      return zoekAlles(items.filter(function (i) { return i.mee }))
    }).catch(function (err) {
      $('#status').textContent = 'Kon je lijst niet laden: ' + err.message
    })
  }
  start()
})()
