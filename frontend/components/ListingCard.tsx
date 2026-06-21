'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, MapPin, Building2, Send, Star, XCircle, MessageCircle } from 'lucide-react'
import type { ContactStatus, Listing } from '@/lib/types'

const SOURCE_COLORS: Record<string, string> = {
  ebay: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  immowelt: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
}

const SOURCE_LABELS: Record<string, string> = {
  ebay: 'eBay',
  immowelt: 'Immowelt',
}

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'Neu',
  interesting: 'Interessant',
  contacted: 'Angeschrieben',
  reply: 'Antwort',
  rejected: 'Abgelehnt',
}

const STATUS_STYLES: Record<ContactStatus, string> = {
  new: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  interesting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  contacted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  reply: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 2 * 60 * 60 * 1000
}

function fmt(n: number): string {
  return new Intl.NumberFormat('de-DE').format(n)
}

function contactStatus(listing: Listing): ContactStatus {
  if (listing.condition === 'interesting') return 'interesting'
  if (listing.condition === 'reply') return 'reply'
  if (listing.condition === 'rejected') return 'rejected'
  if (listing.condition === 'contacted' || listing.notified) return 'contacted'
  return 'new'
}

function fillTemplate(template: string, listing: Listing): string {
  return template
    .replaceAll('{titel}', listing.title)
    .replaceAll('{stadt}', listing.city)
    .replaceAll('{preis}', listing.price ? `${fmt(listing.price)} EUR` : 'der angegebenen Miete')
    .replaceAll('{qm}', listing.sqm ? `${listing.sqm} m²` : 'der angegebenen Wohnfläche')
    .replaceAll('{zimmer}', listing.rooms ? `${listing.rooms} Zimmer` : 'der angegebenen Zimmerzahl')
}

interface Props {
  listing: Listing
  messageTemplate: string
  onStatusChange: (listing: Listing, status: ContactStatus) => Promise<void>
}

export default function ListingCard({ listing, messageTemplate, onStatusChange }: Props) {
  const fresh = listing.created_at && isNew(listing.created_at)
  const status = contactStatus(listing)
  const [copied, setCopied] = useState(false)
  const [savingStatus, setSavingStatus] = useState<ContactStatus | null>(null)

  const copyMessage = async () => {
    await navigator.clipboard.writeText(fillTemplate(messageTemplate, listing))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const setStatus = async (nextStatus: ContactStatus) => {
    setSavingStatus(nextStatus)
    try {
      await onStatusChange(listing, nextStatus)
    } finally {
      setSavingStatus(null)
    }
  }

  return (
    <article className="group block bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden">
      <a href={listing.listing_url} target="_blank" rel="noopener noreferrer" className="block">
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

          {fresh && status === 'new' && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-sm">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              NEU
            </div>
          )}

          <div className="absolute top-2 right-2">
            <span className={`text-xs font-medium px-2 py-1 rounded-lg backdrop-blur-sm ${SOURCE_COLORS[listing.source] || 'bg-gray-100 text-gray-600'}`}>
              {SOURCE_LABELS[listing.source] || listing.source}
            </span>
          </div>
        </div>
      </a>

      <div className="p-4">
        <div className="mb-2">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg ${STATUS_STYLES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>

        <a href={listing.listing_url} target="_blank" rel="noopener noreferrer">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 leading-snug hover:text-primary transition-colors">
            {listing.title}
          </h3>
        </a>

        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 mb-3">
          <MapPin size={11} />
          {listing.city}
        </div>

        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-xl font-bold text-primary dark:text-blue-400 leading-none">
              {listing.price ? `${fmt(listing.price)} €` : 'Miete auf Anfrage'}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
          {listing.price_per_sqm && (
            <p className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">
              {fmt(listing.price_per_sqm)} €/m²
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyMessage} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Kopiert' : 'Text kopieren'}
          </button>
          <a href={listing.listing_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            <ExternalLink size={14} />
            Inserat öffnen
          </a>
        </div>

        <div className="grid grid-cols-4 gap-1.5 mt-2">
          <button title="Interessant" disabled={!!savingStatus} onClick={() => setStatus('interesting')} className="h-8 rounded-lg border border-gray-200 dark:border-slate-600 flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50">
            <Star size={14} />
          </button>
          <button title="Angeschrieben" disabled={!!savingStatus} onClick={() => setStatus('contacted')} className="h-8 rounded-lg border border-gray-200 dark:border-slate-600 flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50">
            <Send size={14} />
          </button>
          <button title="Antwort erhalten" disabled={!!savingStatus} onClick={() => setStatus('reply')} className="h-8 rounded-lg border border-gray-200 dark:border-slate-600 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50">
            <MessageCircle size={14} />
          </button>
          <button title="Abgelehnt" disabled={!!savingStatus} onClick={() => setStatus('rejected')} className="h-8 rounded-lg border border-gray-200 dark:border-slate-600 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
            <XCircle size={14} />
          </button>
        </div>
      </div>
    </article>
  )
}

const fallbackHtml = `<div class="w-full h-full bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center"><svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='1.5'><path d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/></svg></div>`
