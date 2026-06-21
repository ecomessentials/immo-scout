'use client'

import { Home, Sparkles, Clock, SearchCheck } from 'lucide-react'
import { Stats } from '@/lib/types'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Noch kein Scan'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `vor ${diff} Sek.`
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`
  return `vor ${Math.floor(diff / 86400)} Tagen`
}

interface TileProps {
  label: string
  value: string
  icon: React.ReactNode
  color: string
}

function StatTile({ label, value, icon, color }: TileProps) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border-l-4 ${color} border border-gray-100 dark:border-slate-700 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-200`}>
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
      </div>
      <div className="text-gray-300 dark:text-slate-600">
        {icon}
      </div>
    </div>
  )
}

interface Props {
  stats: Stats | undefined
  loading: boolean
}

export default function StatsBar({ stats, loading }: Props) {
  const activeSources = stats ? Object.keys(stats.by_source).length : 0

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatTile
        label="Gesamt gefunden"
        value={(stats?.total ?? 0).toLocaleString('de-DE')}
        icon={<Home size={28} />}
        color="border-l-primary"
      />
      <StatTile
        label="Heute neu"
        value={(stats?.today ?? 0).toString()}
        icon={<Sparkles size={28} />}
        color="border-l-accent"
      />
      <StatTile
        label="Letzter Scan"
        value={timeAgo(stats?.last_scan_at ?? null)}
        icon={<Clock size={28} />}
        color="border-l-emerald-500"
      />
      <StatTile
        label="Aktive Portale"
        value={`${activeSources}/2`}
        icon={<SearchCheck size={28} />}
        color="border-l-purple-500"
      />
    </div>
  )
}
