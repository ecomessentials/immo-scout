'use client'

import { Stats } from '@/lib/types'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Noch kein Scan'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `vor ${diff} Sek.`
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`
  return `vor ${Math.floor(diff / 86400)} Tagen`
}

interface Props {
  stats: Stats | undefined
  loading: boolean
}

export default function StatsBar({ stats, loading }: Props) {
  const activeSources = stats ? Object.keys(stats.by_source).length : 0

  const tiles = [
    {
      label: 'Gesamt gefunden',
      value: loading ? '–' : (stats?.total ?? 0).toString(),
      icon: '🏠',
    },
    {
      label: 'Heute neu',
      value: loading ? '–' : (stats?.today ?? 0).toString(),
      icon: '✨',
    },
    {
      label: 'Letzter Scan',
      value: loading ? '–' : timeAgo(stats?.last_scan_at ?? null),
      icon: '🕐',
    },
    {
      label: 'Aktive Portale',
      value: loading ? '–' : `${activeSources}/4`,
      icon: '🌐',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3"
        >
          <span className="text-2xl">{tile.icon}</span>
          <div>
            <p className="text-xs text-gray-500 leading-none mb-1">{tile.label}</p>
            <p className="text-xl font-bold text-gray-900">{tile.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
