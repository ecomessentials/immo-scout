'use client'

import { useState } from 'react'
import { testTelegram } from '@/lib/api'

export default function TelegramStatus() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')

  const handleTest = async () => {
    setStatus('testing')
    try {
      await testTelegram()
      setStatus('ok')
    } catch {
      setStatus('error')
    }
    setTimeout(() => setStatus('idle'), 5000)
  }

  return (
    <button
      onClick={handleTest}
      disabled={status === 'testing'}
      className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      {status === 'testing' && <span className="animate-pulse">📡</span>}
      {status === 'ok' && <span className="text-green-600">✓</span>}
      {status === 'error' && <span className="text-red-600">✗</span>}
      {status === 'idle' && <span>💬</span>}
      <span className="text-gray-600">
        {status === 'testing' ? 'Teste...' : status === 'ok' ? 'Gesendet!' : status === 'error' ? 'Fehler' : 'Telegram testen'}
      </span>
    </button>
  )
}
