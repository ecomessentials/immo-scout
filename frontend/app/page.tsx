'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import useSWR from 'swr'
import { getListings, getStats } from '@/lib/api'
import { FilterParams } from '@/lib/types'
import StatsBar from '@/components/StatsBar'
import FilterSidebar from '@/components/FilterSidebar'
import ListingGrid from '@/components/ListingGrid'
import ScanButton from '@/components/ScanButton'
import TelegramStatus from '@/components/TelegramStatus'
import LogViewer from '@/components/LogViewer'
import Link from 'next/link'

function Dashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [offset, setOffset] = useState(0)
  const [showLogs, setShowLogs] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
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

  const handleLoadMore = () => setOffset((prev) => prev + LIMIT)

  const handleLogout = () => {
    localStorage.removeItem('authenticated')
    router.replace('/login')
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-4 lg:py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">🏠 Immo Scout</h1>
          <p className="text-xs lg:text-sm text-gray-500 hidden sm:block">
            Automatisches Monitoring für Eigentumswohnungen
          </p>
        </div>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          <TelegramStatus />
          <ScanButton
            lastScan={stats?.last_scan_at ?? null}
            onScanStart={() => setShowLogs(true)}
          />
          <Link
            href="/settings"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
          >
            ⚙️ Einstellungen
          </Link>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
          >
            Abmelden
          </button>
        </div>

        {/* Mobile nav – compact */}
        <div className="flex sm:hidden items-center gap-2">
          <ScanButton
            lastScan={stats?.last_scan_at ?? null}
            onScanStart={() => setShowLogs(true)}
          />
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-400 hover:text-gray-600"
            title="Abmelden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <StatsBar stats={stats} loading={statsLoading} />

      {/* Mobile filter button – visible only below lg */}
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <p className="text-sm text-gray-500">
          {listingsLoading ? 'Lädt...' : `${listings.length} Inserate`}
        </p>
        <button
          onClick={() => setShowFilterModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filter
          {(filterParams.city || filterParams.source || filterParams.max_price || filterParams.min_sqm || filterParams.max_sqm) && (
            <span className="w-2 h-2 bg-blue-600 rounded-full" />
          )}
        </button>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        <FilterSidebar
          mobileOpen={showFilterModal}
          onMobileClose={() => setShowFilterModal(false)}
        />
        <main className="flex-1 min-w-0">
          <div className="hidden lg:flex items-center justify-between mb-4">
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

      <LogViewer open={showLogs} onClose={() => setShowLogs(false)} />
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
