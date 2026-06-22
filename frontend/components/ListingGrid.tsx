'use client'

import { Building2, AlertCircle } from 'lucide-react'
import type { ContactStatus, Listing } from '@/lib/types'
import ListingCard from './ListingCard'

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="aspect-video bg-gray-100 dark:bg-slate-700 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-16 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />
        <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />
        <div className="h-4 w-3/4 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />
        <div className="h-7 w-1/2 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse mt-2" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-6">
        <Building2 size={36} className="text-primary/60 dark:text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2">
        Noch keine Wohnungen gefunden
      </h3>
      <p className="text-sm text-gray-400 dark:text-slate-500 max-w-xs">
        Starte einen Scan um neue Inserate aus allen Portalen zu laden!
      </p>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6">
        <AlertCircle size={36} className="text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2">
        Backend nicht erreichbar
      </h3>
      <p className="text-sm text-gray-400 dark:text-slate-500 max-w-xs">
        Bitte prüfen Sie die Verbindung zum Backend-Server.
      </p>
    </div>
  )
}

interface Props {
  listings: Listing[]
  loading: boolean
  error: boolean
  onLoadMore: () => void
  hasMore: boolean
  messageTemplate: string
  onStatusChange: (listing: Listing, status: ContactStatus) => Promise<void>
}

function scanGroupKey(listing: Listing): string {
  const date = new Date(listing.created_at)
  date.setMinutes(0, 0, 0)
  return date.toISOString()
}

function scanGroupLabel(key: string): string {
  const label = new Date(key).toLocaleString('de-DE', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${label} Uhr`
}

export default function ListingGrid({ listings, loading, error, onLoadMore, hasMore, messageTemplate, onStatusChange }: Props) {
  const groups = listings.reduce<Array<{ key: string; items: Listing[] }>>((acc, listing) => {
    const key = scanGroupKey(listing)
    const group = acc.find((g) => g.key === key)
    if (group) {
      group.items.push(listing)
    } else {
      acc.push({ key, items: [listing] })
    }
    return acc
  }, [])

  return (
    <div>
      {loading && listings.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="grid grid-cols-1">
          <ErrorState />
        </div>
      ) : listings.length === 0 ? (
        <div className="grid grid-cols-1">
          <EmptyState />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="flex items-end justify-between gap-4 mb-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    Neue Wohnungen
                  </p>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Scan {scanGroupLabel(group.key)}
                  </h2>
                </div>
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  {group.items.length} Wohnungen
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {group.items.map((l) => (
                  <ListingCard
                    key={l.id || l.external_id}
                    listing={l}
                    messageTemplate={messageTemplate}
                    onStatusChange={onStatusChange}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-8 text-center">
          <button
            onClick={onLoadMore}
            className="px-8 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition-all duration-200"
          >
            Mehr laden
          </button>
        </div>
      )}
    </div>
  )
}
