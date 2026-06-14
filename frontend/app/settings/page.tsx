'use client'

import { useEffect, useState } from 'react'
import { getConfig, updateConfig, testTelegram } from '@/lib/api'
import { SearchFilter } from '@/lib/types'
import Link from 'next/link'

const DEFAULT_CONFIG: SearchFilter = {
  max_price: 195000,
  min_sqm: 60,
  max_sqm: 130,
  cities: ['Paderborn', 'Gütersloh', 'Bielefeld', 'Herford', 'Rheda-Wiedenbrück', 'Bad Oeynhausen'],
  keywords: ['renovierungsbedürftig', 'sanierungsbedürftig', 'renovierung', 'altbau'],
  active: true,
  scan_interval: 15,
}

export default function SettingsPage() {
  const [config, setConfig] = useState<SearchFilter>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [newKeyword, setNewKeyword] = useState('')
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch(() => setConfig(DEFAULT_CONFIG))
      .finally(() => setLoading(false))
  }, [])

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateConfig(config)
      setConfig(updated)
      showToast('Einstellungen gespeichert!', 'success')
    } catch {
      showToast('Fehler beim Speichern', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTestTelegram = async () => {
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
      setConfig((c) => ({ ...c, keywords: [...c.keywords, kw] }))
    }
    setNewKeyword('')
  }

  const removeKeyword = (kw: string) => {
    setConfig((c) => ({ ...c, keywords: c.keywords.filter((k) => k !== kw) }))
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
        Lädt Einstellungen...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
        <h1 className="text-2xl font-bold text-gray-900">⚙️ Einstellungen</h1>
      </div>

      {toast && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        <div className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Suchfilter</h2>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-1">Max. Preis (€)</label>
            <input
              type="number"
              value={config.max_price}
              onChange={(e) => setConfig((c) => ({ ...c, max_price: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Min. Fläche (m²)</label>
              <input
                type="number"
                value={config.min_sqm}
                onChange={(e) => setConfig((c) => ({ ...c, min_sqm: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Max. Fläche (m²)</label>
              <input
                type="number"
                value={config.max_sqm}
                onChange={(e) => setConfig((c) => ({ ...c, max_sqm: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-1">Scan-Intervall (Minuten)</label>
            <input
              type="number"
              min={5}
              max={60}
              value={config.scan_interval}
              onChange={(e) => setConfig((c) => ({ ...c, scan_interval: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">Keywords</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {config.keywords.map((kw) => (
                <span
                  key={kw}
                  className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                >
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="hover:text-blue-600">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                placeholder="Keyword hinzufügen..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addKeyword}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Suche aktiv</label>
            <button
              onClick={() => setConfig((c) => ({ ...c, active: !c.active }))}
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                config.active ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform ${
                  config.active ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Telegram</h2>
          <button
            onClick={handleTestTelegram}
            disabled={telegramStatus === 'testing'}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {telegramStatus === 'testing' && <span className="animate-pulse">📡</span>}
            {telegramStatus === 'ok' && <span className="text-green-600">✓</span>}
            {telegramStatus === 'error' && <span className="text-red-600">✗</span>}
            {telegramStatus === 'idle' && <span>💬</span>}
            <span>
              {telegramStatus === 'testing' ? 'Sendet...' : telegramStatus === 'ok' ? 'Nachricht gesendet!' : telegramStatus === 'error' ? 'Fehler – Token prüfen' : 'Test-Nachricht senden'}
            </span>
          </button>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Speichert...' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
