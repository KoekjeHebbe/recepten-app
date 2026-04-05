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
      'boter', 'ghee', 'azijn', 'balsamico', 'appelazijn', 'rijstazijn',
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

export const CATEGORIE_NAMEN = WINKELINDELING.map(c => c.naam).concat(['Overig'])

export function categoriseer(naam: string): string {
  const lower = naam.toLowerCase()
  for (const cat of WINKELINDELING) {
    if (cat.keywords.some(kw => lower.includes(kw))) return cat.naam
  }
  return 'Overig'
}
