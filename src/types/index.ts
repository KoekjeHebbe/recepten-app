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

export interface Recept {
  id: string
  titel: string
  datum: string
  personen: number
  bron_url: string | null
  afbeelding_url: string | null
  tags: string[]
  ingredienten: Ingredient[]
  bereiding: string[]
  voedingswaarden: Voedingswaarden
}

export type Dag = 'maandag' | 'dinsdag' | 'woensdag' | 'donderdag' | 'vrijdag' | 'zaterdag' | 'zondag'

export const DAGEN: Dag[] = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']

export interface WeekMenu {
  [dag: string]: string[] // array of recept ids
}
