export interface Ingredient {
  naam: string
  hoeveelheid: number | null   // getal (bijv. 200)
  eenheid: string              // eenheid (bijv. 'g', 'el', 'stuk', '' voor vrij)
  voorraadkast: boolean
  categorie?: string
  macros_referentie?: Macros | null  // macros per 1 canonieke eenheid (float)
}

export interface Macros {
  calorieen: number
  koolhydraten: number
  eiwitten: number
  vetten: number
}

export interface Voedingswaarden {
  per_portie: Macros
  totaal: Macros
  schatting: boolean
}

export interface Onderdeel {
  recept_id: string   // verwijzing naar een ander recept
  porties: number     // aantal porties van dat recept (decimalen toegestaan)
}

export interface Recept {
  id: string
  titel: string
  datum: string
  personen: number
  bron_url: string | null
  afbeelding_url: string | null
  tags: string[]
  ingredienten: Ingredient[]
  onderdelen?: Onderdeel[]
  bereiding: string[]
  voedingswaarden: Voedingswaarden
}

export type Dag = 'maandag' | 'dinsdag' | 'woensdag' | 'donderdag' | 'vrijdag' | 'zaterdag' | 'zondag'

export const DAGEN: Dag[] = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']

export interface WeekmenuItem {
  recept_id: string
  porties: number   // aantal mensen dat eet die dag
}

export interface WeekMenu {
  [dag: string]: WeekmenuItem[]
}
