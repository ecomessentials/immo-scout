import type { SearchFilter } from './types'

export const TARGET_CITIES = [
  'Winterberg',
  'Münster',
  'Bad Salzuflen',
  'Paderborn',
  'Detmold',
  'Hameln',
]

export const DEFAULT_MAX_RENT = 650
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
