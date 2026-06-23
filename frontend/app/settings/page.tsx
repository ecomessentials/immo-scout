'use client'

import { useEffect, useState } from 'react'
import { getConfig, updateConfig, testTelegram, getScanLogs } from '@/lib/api'
import { SearchFilter, ScanLog } from '@/lib/types'
import { Bell, Search, SlidersHorizontal, History, CheckCircle, XCircle, Save, Send } from 'lucide-react'
import useSWR from 'swr'
import { DEFAULT_CONFIG, TARGET_CITIES } from '@/lib/searchConfig'

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100 dark:border-slate-700">
        <span className="text-primary dark:text-blue-400">{icon}</span>
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
      {...rest}
    />
  )
}

function formatDuration(ms: number | null): string {
  if (!ms) return '–'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

export default function SettingsPage() {
  const [config, setConfig] = useState<SearchFilter>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [newKeyword, setNewKeyword] = useState('')
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')

  const { data: scanLogs } = useSWR<ScanLog[]>('scan-logs', getScanLogs, { refreshInterval: 30000 })

  useEffect(() => {
    getConfig().then(setConfig).catch(() => setConfig(DEFAULT_CONFIG)).finally(() => setLoading(false))
  }, [])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateConfig(config)
      showToast('Einstellungen gespeichert!', true)
    } catch {
      showToast('Fehler beim Speichern', false)
    } finally {
      setSaving(false)
    }
  }

  const handleTelegramTest = async () => {
    setTelegramStatus('testing')
    try {
      await testTelegram()
      setTelegramStatus('ok')
    } catch {
      setTelegramStatus('error')
    }
    setTimeout(() => setTelegramStatus('idle'), 5000)
  }

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase()
    if (kw && !config.keywords.includes(kw)) {
      setConfig(c => ({ ...c, keywords: [...c.keywords, kw] }))
    }
    setNewKeyword('')
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Einstellungen</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Konfiguriere Mietsuche und Benachrichtigungen</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-slide-up ${
          toast.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {toast.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Section 1: Suchparameter */}
      <Section icon={<Search size={16} />} title="Suchparameter">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Max. Kaltmiete (€)">
            <Input type="number" value={config.max_price} onChange={e => setConfig(c => ({ ...c, max_price: Number(e.target.value) }))} />
          </Field>
          <Field label="Min. Fläche (m²)">
            <Input type="number" placeholder="Alle" value={config.min_sqm ?? ''} onChange={e => setConfig(c => ({ ...c, min_sqm: e.target.value ? Number(e.target.value) : undefined }))} />
          </Field>
          <Field label="Max. Fläche (m²)">
            <Input type="number" placeholder="Alle" value={config.max_sqm ?? ''} onChange={e => setConfig(c => ({ ...c, max_sqm: e.target.value ? Number(e.target.value) : undefined }))} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Field label="Mindest-Zimmer">
            <Input type="number" min={1} max={10} placeholder="Alle" value={config.min_rooms ?? ''} onChange={e => setConfig(c => ({ ...c, min_rooms: e.target.value ? Number(e.target.value) : undefined }))} />
          </Field>
          <Field label="Max-Zimmer">
            <Input type="number" min={1} max={10} placeholder="Alle" value={config.max_rooms ?? ''} onChange={e => setConfig(c => ({ ...c, max_rooms: e.target.value ? Number(e.target.value) : undefined }))} />
          </Field>
        </div>

        <Field label="Keywords">
          <div className="flex flex-wrap gap-2 mb-2 min-h-8">
            {config.keywords.map(kw => (
              <span key={kw} className="flex items-center gap-1 bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-400 text-xs font-medium px-2.5 py-1 rounded-lg">
                {kw}
                <button onClick={() => setConfig(c => ({ ...c, keywords: c.keywords.filter(k => k !== kw) }))} className="hover:text-red-500 transition-colors ml-0.5">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
              placeholder="Optionales Keyword hinzufügen…"
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            <button onClick={addKeyword} className="btn-primary px-3">+</button>
          </div>
        </Field>
      </Section>

      {/* Section 2: Benachrichtigungen */}
      <Section icon={<Bell size={16} />} title="Benachrichtigungen">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Telegram-Bot</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Sende eine Test-Nachricht an deinen Telegram-Bot</p>
          </div>
          <button
            onClick={handleTelegramTest}
            disabled={telegramStatus === 'testing'}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-all"
          >
            {telegramStatus === 'testing' && <Send size={14} className="animate-pulse" />}
            {telegramStatus === 'ok' && <CheckCircle size={14} className="text-emerald-500" />}
            {telegramStatus === 'error' && <XCircle size={14} className="text-red-500" />}
            {telegramStatus === 'idle' && <Send size={14} />}
            {telegramStatus === 'testing' ? 'Sendet…' : telegramStatus === 'ok' ? 'Gesendet!' : telegramStatus === 'error' ? 'Fehler' : 'Test senden'}
          </button>
        </div>
      </Section>

      {/* Section 3: Scan-Einstellungen */}
      <Section icon={<SlidersHorizontal size={16} />} title="Scan-Einstellungen">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Scan aktiv</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Automatische Suche jede Stunde</p>
          </div>
          <button
            onClick={() => setConfig(c => ({ ...c, active: !c.active }))}
            className={`relative w-11 h-6 rounded-full transition-all duration-200 ${config.active ? 'bg-primary' : 'bg-gray-200 dark:bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${config.active ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <Field label="Scan-Intervall">
          <Input type="text" value="Jede Stunde" onChange={() => {}} disabled />
        </Field>

        <Field label="Zielstädte">
          <div className="flex flex-wrap gap-2">
            {TARGET_CITIES.map(city => (
              <span key={city} className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs font-medium px-2.5 py-1 rounded-lg">
                {city}
              </span>
            ))}
          </div>
        </Field>
      </Section>

      {/* Section 4: Letzte Scans */}
      <Section icon={<History size={16} />} title="Letzte Scans">
        {!scanLogs || scanLogs.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">Noch keine Scan-Logs vorhanden</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-2 pb-3 text-xs font-medium text-gray-500 dark:text-slate-400">Datum</th>
                  <th className="px-2 pb-3 text-xs font-medium text-gray-500 dark:text-slate-400">Gefunden</th>
                  <th className="px-2 pb-3 text-xs font-medium text-gray-500 dark:text-slate-400">Neu</th>
                  <th className="px-2 pb-3 text-xs font-medium text-gray-500 dark:text-slate-400">Dauer</th>
                  <th className="px-2 pb-3 text-xs font-medium text-gray-500 dark:text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {scanLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-2 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {new Date(log.started_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-2 py-2.5 text-gray-700 dark:text-gray-300 font-medium">{log.total_found}</td>
                    <td className="px-2 py-2.5">
                      <span className={`font-medium ${log.new_listings > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}`}>
                        {log.new_listings > 0 ? `+${log.new_listings}` : '0'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-gray-500 dark:text-slate-400">{formatDuration(log.duration_ms)}</td>
                    <td className="px-2 py-2.5">
                      {log.errors.length === 0
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle size={12} /> OK</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><XCircle size={12} /> {log.errors.length} Fehler</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Sticky Save */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-gray-200 dark:border-slate-700 px-4 py-3 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <p className="text-xs text-gray-500 dark:text-slate-400">Änderungen werden sofort wirksam</p>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 btn-primary disabled:opacity-60">
            <Save size={15} />
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
