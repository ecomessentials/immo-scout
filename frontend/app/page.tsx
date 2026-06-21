'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import useSWR from 'swr'
import { getListings, getStats, updateContactStatus } from '@/lib/api'
import type { ContactStatus, FilterParams, Listing } from '@/lib/types'
import StatsBar from '@/components/StatsBar'
import FilterBar from '@/components/FilterBar'
import ListingGrid from '@/components/ListingGrid'

const DEFAULT_MESSAGE = `Hallo,

ich interessiere mich für Ihre Wohnung in {stadt}.

Ich würde sie gerne langfristig anmieten und vorab offen fragen, ob eine möblierte Untervermietung bzw. Nutzung als Ferienwohnung/Airbnb nach Absprache mit Ihnen grundsätzlich denkbar wäre.

Falls ja, freue ich mich über eine kurze Rückmeldung und würde gern einen Besichtigungstermin vereinbaren.

Viele Grüße
Fabio Krieger`

function Dashboard() {
  const searchParams = useSearchParams()
  const [offset, setOffset] = useState(0)
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE)
  const LIMIT = 500

  useEffect(() => {
    const saved = localStorage.getItem('contact_message_template')
    if (saved) setMessageTemplate(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem('contact_message_template', messageTemplate)
  }, [messageTemplate])

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

  const { data: listings = [], isLoading: listingsLoading, error, mutate: mutateListings } = useSWR(
    ['listings', searchParams.toString(), offset],
    () => getListings({ ...filterParams, limit: LIMIT + offset }),
    { refreshInterval: 60000 }
  )

  const handleStatusChange = async (listing: Listing, status: ContactStatus) => {
    if (!listing.id) return
    const previous = listings
    const optimistic = listings.map((item) =>
      item.id === listing.id
        ? { ...item, notified: status !== 'new', condition: status === 'new' ? null : status }
        : item
    )
    await mutateListings(optimistic, false)
    try {
      const updated = await updateContactStatus(listing.id, status)
      await mutateListings((current = []) => current.map((item) => item.id === listing.id ? updated : item), false)
    } catch {
      await mutateListings(previous, false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mietwohnungen für Airbnb</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {listingsLoading ? 'Lädt…' : `${listings.length} von ${stats?.total ?? listings.length} Inseraten angezeigt`}
        </p>
      </div>

      <StatsBar stats={stats} loading={statsLoading} />
      <FilterBar />

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Anschreiben</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Variablen: {'{stadt}'}, {'{titel}'}, {'{preis}'}, {'{qm}'}, {'{zimmer}'}
            </p>
          </div>
          <button
            onClick={() => setMessageTemplate(DEFAULT_MESSAGE)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Zurücksetzen
          </button>
        </div>
        <textarea
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          rows={7}
          className="w-full resize-y rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </section>

      <ListingGrid
        listings={listings}
        loading={listingsLoading}
        error={!!error}
        onLoadMore={() => setOffset((p) => p + LIMIT)}
        hasMore={listings.length >= LIMIT + offset}
        messageTemplate={messageTemplate}
        onStatusChange={handleStatusChange}
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
