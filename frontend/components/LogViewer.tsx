'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

type LogLevel = 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG'

const LEVEL_COLORS: Record<LogLevel, string> = {
  ERROR: 'text-red-400',
  WARNING: 'text-yellow-300',
  INFO: 'text-green-400',
  DEBUG: 'text-gray-500',
}

function classifyLine(line: string): LogLevel {
  if (line.includes('[ERROR]')) return 'ERROR'
  if (line.includes('[WARNING]') || line.includes('[WARN]')) return 'WARNING'
  if (line.includes('[INFO]')) return 'INFO'
  return 'DEBUG'
}

const MAX_LINES = 500
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export default function LogViewer({ open, onClose }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!open) {
      esRef.current?.close()
      esRef.current = null
      setConnected(false)
      setError(false)
      return
    }

    setLines([])
    setError(false)

    const es = new EventSource(`${BACKEND_URL}/api/logs/stream`)
    esRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      const line = e.data as string
      setLines((prev) => {
        const next = [...prev, line]
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
      })
    }

    es.onerror = () => {
      setConnected(false)
      setError(true)
      es.close()
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [open])

  // Auto-scroll whenever new lines arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-4xl flex flex-col rounded-xl border border-gray-700 bg-gray-950 shadow-2xl"
        style={{ height: '60vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                error ? 'bg-red-500' : connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
              }`}
            />
            <span className="font-mono text-sm text-gray-300">
              {error ? 'Verbindungsfehler' : connected ? 'Live Log' : 'Verbinde...'}
            </span>
            <span className="text-gray-600 font-mono text-xs">
              ({lines.length} Zeilen)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors text-sm px-2 py-1 rounded hover:bg-gray-800"
          >
            ✕ Schließen
          </button>
        </div>

        {/* Log output */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-5 space-y-px">
          {lines.length === 0 && !error && (
            <p className="text-gray-600 italic">Warte auf Log-Einträge...</p>
          )}
          {error && (
            <p className="text-red-400">
              Konnte keine Verbindung zum Backend herstellen. Bitte prüfen Sie, ob der Server läuft.
            </p>
          )}
          {lines.map((line, i) => {
            const level = classifyLine(line)
            return (
              <div key={i} className={`whitespace-pre-wrap break-all ${LEVEL_COLORS[level]}`}>
                {line}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
