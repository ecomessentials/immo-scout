export interface Listing {
  id: string
  external_id: string
  source: 'immoscout24' | 'ebay' | 'immowelt' | 'immonet'
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
  cities: string[]
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
  city?: string
  source?: string
  limit?: number
  offset?: number
}
