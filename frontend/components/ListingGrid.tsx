'use client'

import { Listing } from '@/lib/types'
import ListingCard from './ListingCard'

interface Props {
  listings: Listing[]
  loading: boolean
  onLoadMore: () => void
  hasMore: boolean
}

export default function ListingGrid({ listings, loading, onLoadMore, hasMore }: Props) {
  if (loading && listings.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl animate-pulse h-72" />
        ))}
      </div>
    )
  }

  if (!loading && listings.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-2xl mb-2">🏠</p>
        <p className="text-lg font-medium">Keine Inserate gefunden</p>
        <p className="text-sm">Passen Sie die Filter an oder starten Sie einen neuen Scan.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id || listing.external_id} listing={listing} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Lädt...' : 'Mehr laden'}
          </button>
        </div>
      )}
    </div>
  )
}
