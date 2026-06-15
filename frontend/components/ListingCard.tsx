'use client'

import { MapPin, Building2, ExternalLink } from 'lucide-react'
import { Listing } from '@/lib/types'

const SOURCE_COLORS: Record<string, string> = {
  ebay: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  immowelt: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  immonet: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
}

const SOURCE_LABELS: Record<string, string> = {
  ebay: 'eBay',
  immowelt: 'Immowelt',
  immonet: 'Immonet',
}

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 2 * 60 * 60 * 1000
}

function fmt(n: number): string {
  return new Intl.NumberFormat('de-DE').format(n)
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const fresh = listing.created_at && isNew(listing.created_at)

  return (
    <a
      href={listing.listing_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-200 hover:scale-[1.01] hover:-translate-y-0.5 overflow-hidden"
    >
      {/* Image */}
      <div className="relative aspect-video overflow-hidden">
        {listing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = fallbackHtml }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
            <Building2 size={44} className="text-white/30" />
          </div>
        )}

        {/* NEU Badge */}
        {fresh && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-sm">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            NEU
          </div>
        )}

        {/* Source Badge */}
        <div className="absolute top-2 right-2">
          <span className={`text-xs font-medium px-2 py-1 rounded-lg backdrop-blur-sm ${SOURCE_COLORS[listing.source] || 'bg-gray-100 text-gray-600'}`}>
            {SOURCE_LABELS[listing.source] || listing.source}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Condition badge */}
        {listing.condition && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              🔧 Renovierung
            </span>
          </div>
        )}

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 leading-snug group-hover:text-primary transition-colors">
          {listing.title}
        </h3>

        {/* City */}
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 mb-3">
          <MapPin size={11} />
          {listing.city}
        </div>

        {/* Price + stats */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xl font-bold text-primary dark:text-blue-400 leading-none">
              {listing.price ? `${fmt(listing.price)} €` : 'Preis auf Anfrage'}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              {listing.sqm && (
                <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-lg font-medium">
                  {listing.sqm} m²
                </span>
              )}
              {listing.rooms && (
                <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-lg font-medium">
                  {listing.rooms} Zi.
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            {listing.price_per_sqm && (
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">
                {fmt(listing.price_per_sqm)} €/m²
              </p>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary dark:text-blue-400 group-hover:gap-1.5 transition-all">
              Zum Inserat <ExternalLink size={11} />
            </span>
          </div>
        </div>
      </div>
    </a>
  )
}

const fallbackHtml = `<div class="w-full h-full bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center"><svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='1.5'><path d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/></svg></div>`
