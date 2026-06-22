export interface Listing {
  id: string
  external_id: string
  source: 'ebay' | 'immowelt' | 'immoscout24'
  title: string
  price: number | null
  sqm: number | null
  rooms: number | null
  city: string
  address: string | null
  description: string | null
  image_url: string | null
  listing_url: string
  condition: string | null
  notified: boolean
  created_at: string
  price_per_sqm: number | null
}

export type ContactStatus = 'new' | 'interesting' | 'contacted' | 'reply' | 'rejected'

export interface Stats {
  total: number
  today: number
  by_source: Record<string, number>
  last_scan_at: string | null
}

export interface SearchFilter {
  max_price: number
  min_sqm: number
  max_sqm: number
  min_rooms?: number
  max_rooms?: number
  cities: string[]
  default_radius: number
  city_radius: Record<string, number>
  keywords: string[]
  active: boolean
  scan_interval: number
}

export interface ScanLog {
  id: string
  started_at: string
  finished_at: string
  duration_ms: number
  total_found: number
  new_listings: number
  errors: Array<{ scraper: string; city: string; error: string }>
  sources_scanned: string[]
}

export interface FilterParams {
  min_price?: number
  max_price?: number
  min_sqm?: number
  max_sqm?: number
  min_rooms?: number
  max_rooms?: number
  city?: string
  source?: string
  limit?: number
  offset?: number
}
