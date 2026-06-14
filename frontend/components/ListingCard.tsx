'use client'

import { Listing } from '@/lib/types'

const SOURCE_COLORS: Record<string, string> = {
  immoscout24: 'bg-green-100 text-green-800',
  ebay: 'bg-yellow-100 text-yellow-800',
  immowelt: 'bg-blue-100 text-blue-800',
  immonet: 'bg-purple-100 text-purple-800',
}

const SOURCE_LABELS: Record<string, string> = {
  immoscout24: 'ImmoScout24',
  ebay: 'eBay Kleinanz.',
  immowelt: 'Immowelt',
  immonet: 'Immonet',
}

function isNew(createdAt: string): boolean {
  const created = new Date(createdAt)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  return created > twoHoursAgo
}

function formatPrice(price: number | null): string {
  if (price == null) return 'k.A.'
  return new Intl.NumberFormat('de-DE').format(price) + ' €'
}

interface Props {
  listing: Listing
}

export default function ListingCard({ listing }: Props) {
  return (
    <a
      href={listing.listing_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
    >
      <div className="relative aspect-video bg-gray-100">
        {listing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </div>
        )}
        {listing.created_at && isNew(listing.created_at) && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            NEU
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex gap-2 mb-2 flex-wrap">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${SOURCE_COLORS[listing.source] || 'bg-gray-100 text-gray-700'}`}>
            {SOURCE_LABELS[listing.source] || listing.source}
          </span>
          {listing.condition && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-800">
              🔧 {listing.condition}
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 leading-snug">
          {listing.title}
        </h3>

        <p className="text-xs text-gray-500 mb-3">📍 {listing.city}</p>

        <div className="flex gap-3 text-sm text-gray-700 mb-2">
          <span className="font-bold text-gray-900">{formatPrice(listing.price)}</span>
          {listing.sqm != null && <span>📐 {listing.sqm} m²</span>}
          {listing.rooms != null && <span>🚪 {listing.rooms} Zi</span>}
        </div>

        {listing.price_per_sqm != null && (
          <p className="text-xs text-gray-500">
            💡 {new Intl.NumberFormat('de-DE').format(listing.price_per_sqm)} €/m²
          </p>
        )}
      </div>
    </a>
  )
}
