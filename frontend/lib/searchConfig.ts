import type { SearchFilter } from './types'

export const TARGET_CITIES = [
  'Winterberg',
  'Willingen',
  'Schmallenberg',
  'Bad Berleburg',
  'Medebach',
  'Olsberg',
  'Brilon',
  'Hallenberg',
  'Eslohe',
  'Marsberg',
  'Sundern',
  'Arnsberg',
  'Meschede',
  'Bestwig',
  'Diemelsee',
  'Bad Driburg',
  'Bad Pyrmont',
  'Horn-Bad Meinberg',
  'Detmold',
  'Lemgo',
  'Bad Salzuflen',
  'Höxter',
  'Steinheim',
  'Schieder-Schwalenberg',
  'Blomberg',
  'Augustdorf',
  'Bad Lippspringe',
  'Bodenwerder',
  'Hameln',
  'Möhnesee',
]

export const DEFAULT_MAX_RENT = 1500
export const DEFAULT_MIN_SQM = 25
export const DEFAULT_MAX_SQM = 140
export const DEFAULT_MIN_ROOMS = 1
export const DEFAULT_MAX_ROOMS = 5
export const DEFAULT_SCAN_INTERVAL = 180

export const DEFAULT_CONFIG: SearchFilter = {
  max_price: DEFAULT_MAX_RENT,
  min_sqm: DEFAULT_MIN_SQM,
  max_sqm: DEFAULT_MAX_SQM,
  min_rooms: DEFAULT_MIN_ROOMS,
  max_rooms: DEFAULT_MAX_ROOMS,
  cities: TARGET_CITIES,
  default_radius: 0,
  city_radius: {},
  keywords: [],
  active: true,
  scan_interval: DEFAULT_SCAN_INTERVAL,
}
