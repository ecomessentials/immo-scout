import type { ContactStatus, Listing, Stats, SearchFilter, ScanLog, FilterParams } from './types'
import { DEFAULT_CONFIG } from './searchConfig'

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const EMPTY_STATS: Stats = { total: 0, today: 0, by_source: {}, last_scan_at: null }

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function getListings(params: FilterParams = {}): Promise<Listing[]> {
  const query = new URLSearchParams()
  if (params.min_price != null) query.set('min_price', String(params.min_price))
  if (params.max_price != null) query.set('max_price', String(params.max_price))
  if (params.min_sqm != null) query.set('min_sqm', String(params.min_sqm))
  if (params.max_sqm != null) query.set('max_sqm', String(params.max_sqm))
  if (params.min_rooms != null) query.set('min_rooms', String(params.min_rooms))
  if (params.max_rooms != null) query.set('max_rooms', String(params.max_rooms))
  if (params.city) query.set('city', params.city)
  if (params.source) query.set('source', params.source)
  if (params.limit != null) query.set('limit', String(params.limit))
  if (params.offset != null) query.set('offset', String(params.offset))
  const qs = query.toString()
  try {
    return await apiFetch<Listing[]>(`/api/listings${qs ? `?${qs}` : ''}`)
  } catch {
    return []
  }
}

export async function getStats(): Promise<Stats> {
  try {
    return await apiFetch<Stats>('/api/stats')
  } catch {
    return EMPTY_STATS
  }
}

export async function triggerScan(): Promise<void> {
  await apiFetch('/api/trigger-scan', { method: 'POST' })
}

export async function getConfig(): Promise<SearchFilter> {
  try {
    return await apiFetch<SearchFilter>('/api/config')
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function updateConfig(config: SearchFilter): Promise<SearchFilter> {
  return apiFetch<SearchFilter>('/api/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export async function updateContactStatus(id: string, status: ContactStatus): Promise<Listing> {
  return apiFetch<Listing>(`/api/listings/${id}/contact`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function getScanLogs(): Promise<ScanLog[]> {
  try {
    return await apiFetch<ScanLog[]>('/api/scan-logs')
  } catch {
    return []
  }
}

export async function testTelegram(): Promise<void> {
  await apiFetch('/api/telegram/test')
}
