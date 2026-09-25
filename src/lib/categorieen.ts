export const WINKELINDELING: { naam: string; keywords: string[] }[] = [
  {
    naam: 'Vlees',
    keywords: [
      'gehakt', 'kip', 'lam', 'lamsvlees', 'varken', 'varkensvlees', 'spek', 'chorizo',
      'pancetta', 'worst', 'rib', 'ribben', 'shoarma', 'kebab', 'doner', 'filet',
      'kipfilet', 'steak', 'biefstuk', 'bacon', 'entrecote', 'tartaar', 'pulled',
      'drumstick', 'dij', 'borst', 'kalfs', 'kalkoen', 'eend', 'konijn',
    ],
  },
  {
    naam: 'Vis & Zeevruchten',
    keywords: [
      'forel', 'zalm', 'garnalen', 'gambas', 'shrimp', 'tonijn', 'ansjovis',
      'inktvis', 'scampi', 'zeevruchten', 'vis', 'kabeljauw', 'tilapia',
      'mosselen', 'oesters', 'kreeft', 'krab', 'zeebaars', 'makreel', 'haring',
    ],
  },
  {
    naam: 'Groenten & Fruit',
    keywords: [
      'ajuin', 'ui', 'wortel', 'selder', 'knoflook', 'tomaat', 'paprika',
      'courgette', 'aubergine', 'champignon', 'prei', 'spinazie', 'sla',
      'rucola', 'citroen', 'limoen', 'avocado', 'aardappel', 'patata',
      'lente-ui', 'rode ui', 'chilipeper', 'chili', 'peper', 'appel', 'peer',
      'banaan', 'aardbei', 'blauwe bes', 'mango', 'ananas', 'druif',
      'granaatappel', 'venkel', 'knolselder', 'pastinaak', 'biet', 'rode biet',
      'zoete aardappel', 'butternut', 'pompoen', 'broccoli', 'bloemkool',
      'spruitjes', 'asperge', 'artisjok', 'mais', 'erwt', 'edamame', 'raap',
      'radijs', 'komkommer', 'ijsbergsla', 'veldsla', 'witloof', 'look',
    ],
  },
  {
    naam: 'Zuivel',
    keywords: [
      'kaas', 'room', 'slagroom', 'boter', 'yoghurt', 'melk', 'hüttenkäse',
      'mozzarella', 'halloumi', 'feta', 'parmezaan', 'pecorino', 'ei', 'eieren',
      'mascarpone', 'crème', 'creme fraiche', 'zure room', 'brie', 'camembert',
      'ricotta', 'cottage cheese', 'gouda', 'emmental', 'gruyère',
    ],
  },
  {
    naam: 'Droge voeding',
    keywords: [
      'pasta', 'spaghetti', 'tagliatelle', 'orzo', 'penne', 'rigatoni', 'fusilli',
      'rijst', 'bloem', 'brood', 'pita', 'flatbread', 'passata', 'bonen',
      'linzen', 'tomatenpuree', 'tomatenblokjes', 'polenta', 'couscous',
      'noten', 'pijnboom', 'rozijn', 'olijven', 'kapper', 'harissa', 'blik',
      'kikkererwt', 'kidneyboon', 'witte boon', 'zwarte boon', 'quinoa',
      'bulgur', 'havermout', 'crackers', 'tortilla', 'wraps', 'panko',
      'paneermeel', 'suiker', 'honing', 'siroop', 'jam', 'confituur',
      'conserven', 'ingeblikt', 'gedroogd',
    ],
  },
  {
    naam: 'Kruiden & Specerijen',
    keywords: [
      'peterselie', 'basilicum', 'munt', 'koriander', 'tijm', 'rozemarijn',
      'oregano', 'salie', 'bieslook', 'dille', 'laurier', 'dragon',
      'kurkuma', 'paprikapoeder', 'komijn', 'korianderzaad', 'kardemom',
      'kaneel', 'nootmuskaat', 'kruidnagel', 'piment', 'steranijs',
      'ras el hanout', 'kerrie', 'curry', 'garam masala', 'cayenne',
      'sumak', 'za\'atar', 'baharat', 'dukkah', 'berbere', 'saffraan',
    ],
  },
  {
    naam: 'Sauzen & Condimenten',
    keywords: [
      'sojasaus', 'ketjap', 'oestersaus', 'vissaus', 'worcestershire',
      'tabasco', 'sriracha', 'sambal', 'mosterd', 'mayonaise', 'ketchup',
      'pesto', 'tapenade', 'hummus', 'tahini', 'miso', 'hoisin',
      'teriyaki', 'barbecuesaus', 'sweet chili', 'chutney',
    ],
  },
  {
    naam: 'Olie & Azijn',
    keywords: [
      'olijfolie', 'zonnebloemolie', 'kokosolie', 'sesamolie', 'koolzaadolie',
      'ghee', 'azijn', 'balsamico', 'appelazijn', 'rijstazijn',
      'wijnazijn', 'sherryazijn',
    ],
  },
  {
    naam: 'Drank & Bouillon',
    keywords: [
      'wijn', 'witte wijn', 'rode wijn', 'bier', 'bouillon', 'kippenbouillon',
      'groentebouillon', 'vleesbouillon', 'fond', 'stock', 'kokosmelk',
      'kokosroom', 'amandelmelk', 'sojamelk', 'havermelk',
    ],
  },
  {
    naam: 'Diepvries',
    keywords: ['diepvries', 'bevroren', 'frozen'],
  },
  {
    naam: 'Kuisproducten',
    keywords: [],
  },
]

const EXTRA_KEYWORDS: Record<string, string[]> = {
  'Vlees': ['ham', 'boerenham', 'hamburger', 'salami', 'prosciutto', 'rund', 'rundvlees', 'kalfsvlees', 'merguez', 'gyros', 'kippendij', 'kipdij'],
  'Vis & Zeevruchten': ['zalmfilet', 'visfilet', 'forelfilet', 'kabeljauwfilet', 'tonijnsteak', 'zalmsteak', 'sardien', 'ansjovisreepjes', 'ansjovisfilet'],
  'Groenten & Fruit': ['sjalot', 'uitjes', 'uien', 'bleekselderij', 'spitskool', 'kool', 'rode kool', 'boontjes', 'sperziebonen', 'gember', 'lente ui', 'bosui', 'jalapeño', 'jalapeno', 'paksoi', 'taugé', 'bloemkoolrijst', 'tomaten', 'tomaatjes', 'kerstomaat', 'koolrabi', 'kers', 'tuinkers', 'waterkers', 'framboos', 'frambozen', 'bessen', 'mandarijn', 'sinaasappel', 'vijg', 'dadel', 'pomelo'],
  'Zuivel': ['roomkaas', 'philadelphia', 'kwark', 'skyr', 'kookroom', 'parmigiano', 'reggiano', 'grana padano', 'eiwit', 'eidooier', 'burrata', 'manchego', 'cheddar'],
  'Droge voeding': ['meel', 'amandelmeel', 'psyllium', 'psylliumvezels', 'bakpoeder', 'maizena', 'augurk', 'noedels', 'lasagne', 'broodkruim', 'chiazaad', 'sesamzaad', 'tomatenstukjes', 'knackebrod', 'knäckebröd', 'stevia', 'cannellini'],
  'Kruiden & Specerijen': ['zout', 'zwarte peper', 'witte peper', 'peper en zout', 'zout en peper', 'uienpoeder', 'knoflookpoeder', 'gemberpoeder', 'kerriepoeder', 'currypoeder', 'chilivlokken', 'chilipoeder', 'gochugaru', 'kruiden', 'kruidenmix', 'gerookte paprika', 'paprikapoeder'],
  'Sauzen & Condimenten': ['dijon', 'dijonmosterd', 'mayo', 'chipotle', 'salsa', 'dressing', 'pili-pili'],
  'Olie & Azijn': ['witte wijnazijn', 'rode wijnazijn', 'rodewijnazijn'],
  'Drank & Bouillon': ['bouillonblokje'],
}
for (const cat of WINKELINDELING) cat.keywords.push(...(EXTRA_KEYWORDS[cat.naam] ?? []))

export const CATEGORIE_NAMEN = WINKELINDELING.map(c => c.naam).concat(['Overig'])

// Korte trefwoorden ("ui", "ei", "kip", "ham") tellen alleen aan het begin of
// einde van een woord: anders valt "kruiden" onder Groenten (ui) en
// "champignon" onder Vlees (ham).
function komtVoor(tekst: string, kw: string): boolean {
  if (kw.length > 3) return tekst.includes(kw)
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-zà-ÿ])${esc}|${esc}($|[^a-zà-ÿ])`).test(tekst)
}

export function categoriseer(naam: string): string {
  // Bereidingswijze telt niet mee: "ui, gehakt" en "gehakte peterselie" zijn geen vlees.
  const lower = naam.toLowerCase()
    .split(',')[0]
    .replace(/(^|\s)(fijn)?gehakte(\s|$)/g, ' ')
    .replace(/fijngehakt/g, ' ')
    .trim()
  // "gedroogd" is zwak: "Salie gedroogd" is een kruid, pas zonder beter trefwoord droge voeding.
  const zonderGedroogd = lower.replace(/gedroogde?/g, ' ')
  const beste = besteCategorie(zonderGedroogd)
  if (beste === 'Overig' && zonderGedroogd !== lower) return 'Droge voeding'
  return beste
}

// Het langste (meest specifieke) trefwoord wint: "kippenbouillon" is bouillon,
// geen kip; "dijonmosterd" is mosterd; "kabeljauwfilet" is vis.
function besteCategorie(lower: string): string {
  let beste = 'Overig'
  let besteLengte = 0
  for (const cat of WINKELINDELING) {
    for (const kw of cat.keywords) {
      if (kw.length > besteLengte && komtVoor(lower, kw)) {
        beste = cat.naam
        besteLengte = kw.length
      }
    }
  }
  return beste
}
