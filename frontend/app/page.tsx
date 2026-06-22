'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { getListings, getStats, updateContactStatus } from '@/lib/api'
import type { ContactStatus, FilterParams, Listing, Stats } from '@/lib/types'
import { CheckCircle2, MessageCircle, Send, Sparkles, Star, XCircle } from 'lucide-react'
import StatsBar from '@/components/StatsBar'
import FilterBar from '@/components/FilterBar'
import ListingGrid from '@/components/ListingGrid'
import { DEFAULT_MAX_RENT } from '@/lib/searchConfig'

const DEFAULT_MESSAGE = `Hallo,

ich interessiere mich für Ihre Wohnung in {stadt}.

Ich würde sie gerne langfristig anmieten und vorab offen fragen, ob eine möblierte Untervermietung bzw. Nutzung als Ferienwohnung/Airbnb nach Absprache mit Ihnen grundsätzlich denkbar wäre.

Falls ja, freue ich mich über eine kurze Rückmeldung und würde gern einen Besichtigungstermin vereinbaren.

Viele Grüße
Fabio Krieger`

const CONTACT_DASHBOARD: Array<{
  status: ContactStatus
  label: string
  icon: React.ReactNode
  className: string
}> = [
  {
    status: 'new',
    label: 'Neu',
    icon: <Sparkles size={18} />,
    className: 'border-l-slate-400 text-slate-500 dark:text-slate-300',
  },
  {
    status: 'interesting',
    label: 'Interesse',
    icon: <Star size={18} />,
    className: 'border-l-amber-500 text-amber-600 dark:text-amber-300',
  },
  {
    status: 'contacted',
    label: 'Angeschrieben',
    icon: <Send size={18} />,
    className: 'border-l-blue-500 text-blue-600 dark:text-blue-300',
  },
  {
    status: 'reply',
    label: 'Antwort',
    icon: <MessageCircle size={18} />,
    className: 'border-l-emerald-500 text-emerald-600 dark:text-emerald-300',
  },
  {
    status: 'rejected',
    label: 'Abgelehnt',
    icon: <XCircle size={18} />,
    className: 'border-l-red-500 text-red-600 dark:text-red-300',
  },
]

function getContactStatus(listing: Listing): ContactStatus {
  if (listing.condition === 'interesting') return 'interesting'
  if (listing.condition === 'reply') return 'reply'
  if (listing.condition === 'rejected') return 'rejected'
  if (listing.condition === 'contacted' || listing.notified) return 'contacted'
  return 'new'
}

function ContactDashboard({ listings }: { listings: Listing[] }) {
  const counts = listings.reduce<Record<ContactStatus, number>>((acc, listing) => {
    const status = getContactStatus(listing)
    acc[status] += 1
    return acc
  }, { new: 0, interesting: 0, contacted: 0, reply: 0, rejected: 0 })
  const handled = listings.length - counts.new

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Kontakt-Dashboard</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Status der aktuell angezeigten Wohnungen
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-gray-600 dark:text-slate-300">
          <CheckCircle2 size={14} className="text-emerald-500" />
          {handled} bearbeitet
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {CONTACT_DASHBOARD.map((item) => (
          <div
            key={item.status}
            className={`border-l-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-3 ${item.className}`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{item.label}</span>
              <span>{item.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
              {counts[item.status].toLocaleString('de-DE')}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

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
    max_price: searchParams.get('max_price') ? Number(searchParams.get('max_price')) : DEFAULT_MAX_RENT,
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

  const displayStats = useMemo<Stats | undefined>(() => {
    if (!listings.length) return stats
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const bySource = listings.reduce<Record<string, number>>((acc, listing) => {
      acc[listing.source] = (acc[listing.source] || 0) + 1
      return acc
    }, {})

    return {
      total: listings.length,
      today: listings.filter((listing) => new Date(listing.created_at) >= todayStart).length,
      by_source: bySource,
      last_scan_at: stats?.last_scan_at ?? null,
    }
  }, [listings, stats])

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
          {listingsLoading ? 'Lädt…' : `${listings.length} von ${displayStats?.total ?? listings.length} Inseraten angezeigt`}
        </p>
      </div>

      <StatsBar stats={displayStats} loading={statsLoading && listings.length === 0} />
      <ContactDashboard listings={listings} />
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
