'use client'

import { useState } from 'react'
import { triggerScan } from '@/lib/api'

interface Props {
  lastScan: string | null
}

export default function ScanButton({ lastScan }: Props) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'started' | 'error'>('idle')

  const handleScan = async () => {
    setLoading(true)
    setStatus('idle')
    try {
      await triggerScan()
      setStatus('started')
      setTimeout(() => setStatus('idle'), 4000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 4000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {lastScan && (
        <span className="text-xs text-gray-400 hidden sm:block">
          Letzter Scan: {new Date(lastScan).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      <button
        onClick={handleScan}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Scant...
          </>
        ) : (
          <>🔍 Jetzt scannen</>
        )}
      </button>
      {status === 'started' && (
        <span className="text-xs text-green-600 font-medium">✓ Scan gestartet</span>
      )}
      {status === 'error' && (
        <span className="text-xs text-red-600 font-medium">✗ Fehler</span>
      )}
    </div>
  )
}
