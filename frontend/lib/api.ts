import { Listing, Stats, SearchFilter, ScanLog, FilterParams } from './types'

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

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
  if (params.city) query.set('city', params.city)
  if (params.source) query.set('source', params.source)
  if (params.limit != null) query.set('limit', String(params.limit))
  if (params.offset != null) query.set('offset', String(params.offset))
  const qs = query.toString()
  return apiFetch<Listing[]>(`/api/listings${qs ? `?${qs}` : ''}`)
}

export async function getStats(): Promise<Stats> {
  return apiFetch<Stats>('/api/stats')
}

export async function triggerScan(): Promise<void> {
  await apiFetch('/api/trigger-scan', { method: 'POST' })
}

export async function getConfig(): Promise<SearchFilter> {
  return apiFetch<SearchFilter>('/api/config')
}

export async function updateConfig(config: SearchFilter): Promise<SearchFilter> {
  return apiFetch<SearchFilter>('/api/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export async function getScanLogs(): Promise<ScanLog[]> {
  return apiFetch<ScanLog[]>('/api/scan-logs')
}

export async function testTelegram(): Promise<void> {
  await apiFetch('/api/telegram/test')
}
