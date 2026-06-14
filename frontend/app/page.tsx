'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import useSWR from 'swr'
import { getListings, getStats } from '@/lib/api'
import { FilterParams } from '@/lib/types'
import StatsBar from '@/components/StatsBar'
import FilterSidebar from '@/components/FilterSidebar'
import ListingGrid from '@/components/ListingGrid'
import ScanButton from '@/components/ScanButton'
import TelegramStatus from '@/components/TelegramStatus'
import Link from 'next/link'

function Dashboard() {
  const searchParams = useSearchParams()
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const filterParams: FilterParams = {
    max_price: searchParams.get('max_price') ? Number(searchParams.get('max_price')) : undefined,
    min_sqm: searchParams.get('min_sqm') ? Number(searchParams.get('min_sqm')) : undefined,
    max_sqm: searchParams.get('max_sqm') ? Number(searchParams.get('max_sqm')) : undefined,
    city: searchParams.get('city') || undefined,
    source: searchParams.get('source') || undefined,
    limit: LIMIT,
    offset: 0,
  }

  const { data: stats, isLoading: statsLoading } = useSWR('stats', getStats, {
    refreshInterval: 60000,
  })

  const { data: listings = [], isLoading: listingsLoading } = useSWR(
    ['listings', searchParams.toString()],
    () => getListings({ ...filterParams, limit: LIMIT + offset }),
    { refreshInterval: 60000 }
  )

  const handleLoadMore = () => {
    setOffset((prev) => prev + LIMIT)
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏠 Immo Scout</h1>
          <p className="text-sm text-gray-500">Automatisches Monitoring für Eigentumswohnungen</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <TelegramStatus />
          <ScanButton lastScan={stats?.last_scan_at ?? null} />
          <Link
            href="/settings"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
          >
            ⚙️ Einstellungen
          </Link>
        </div>
      </header>

      <StatsBar stats={stats} loading={statsLoading} />

      <div className="flex gap-6 flex-col lg:flex-row">
        <FilterSidebar />
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {listingsLoading ? 'Lädt...' : `${listings.length} Inserate`}
            </p>
          </div>
          <ListingGrid
            listings={listings}
            loading={listingsLoading}
            onLoadMore={handleLoadMore}
            hasMore={listings.length >= LIMIT + offset}
          />
        </main>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  )
}
