'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import useSWR from 'swr'
import { getListings, getStats } from '@/lib/api'
import { FilterParams } from '@/lib/types'
import StatsBar from '@/components/StatsBar'
import FilterBar from '@/components/FilterBar'
import ListingGrid from '@/components/ListingGrid'

function Dashboard() {
  const searchParams = useSearchParams()
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const filterParams: FilterParams = {
    max_price: searchParams.get('max_price') ? Number(searchParams.get('max_price')) : undefined,
    min_sqm: searchParams.get('min_sqm') ? Number(searchParams.get('min_sqm')) : undefined,
    max_sqm: searchParams.get('max_sqm') ? Number(searchParams.get('max_sqm')) : undefined,
    min_rooms: searchParams.get('min_rooms') ? Number(searchParams.get('min_rooms')) : undefined,
    max_rooms: searchParams.get('max_rooms') ? Number(searchParams.get('max_rooms')) : undefined,
    city: searchParams.get('city') || undefined,
    source: searchParams.get('source') || undefined,
  }

  const { data: stats, isLoading: statsLoading } = useSWR('stats', getStats, {
    refreshInterval: 60000,
  })

  const { data: listings = [], isLoading: listingsLoading, error } = useSWR(
    ['listings', searchParams.toString(), offset],
    () => getListings({ ...filterParams, limit: LIMIT + offset }),
    { refreshInterval: 60000 }
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {listingsLoading ? 'Lädt…' : `${listings.length} Inserate gefunden`}
        </p>
      </div>

      <StatsBar stats={stats} loading={statsLoading} />
      <FilterBar />

      <ListingGrid
        listings={listings}
        loading={listingsLoading}
        error={!!error}
        onLoadMore={() => setOffset((p) => p + LIMIT)}
        hasMore={listings.length >= LIMIT + offset}
      />
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
