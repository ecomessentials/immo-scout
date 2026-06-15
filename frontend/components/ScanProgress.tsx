'use client'

import { useEffect, useRef, useState } from 'react'

interface Step {
  status: 'ok' | 'error' | 'info' | 'done'
  message: string
}

interface Props {
  open: boolean
  onClose: () => void
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

function StepIcon({ status, isLast }: { status: Step['status']; isLast: boolean }) {
  if (status === 'ok') return <span className="text-base">✅</span>
  if (status === 'error') return <span className="text-base">❌</span>
  // info: blink only if it's the last step (still running), otherwise static
  return (
    <span className={`text-base ${isLast ? 'animate-pulse' : ''}`}>🔍</span>
  )
}

export default function ScanProgress({ open, onClose }: Props) {
  const [steps, setSteps] = useState<Step[]>([])
  const [done, setDone] = useState(false)
  const [connectionError, setConnectionError] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!open) {
      esRef.current?.close()
      esRef.current = null
      setSteps([])
      setDone(false)
      setConnectionError(false)
      return
    }

    const es = new EventSource(`${BACKEND_URL}/api/scan/stream`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as Step
        if (event.status === 'done') {
          setDone(true)
          es.close()
          esRef.current = null
          return
        }
        setSteps((prev) => [...prev, event])
      } catch {
        // ignore malformed events
      }
    }

    es.onerror = () => {
      setConnectionError(true)
      setDone(true)
      es.close()
      esRef.current = null
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [open])

  // Auto-scroll to newest step
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps])

  if (!open) return null

  const visibleSteps = steps.filter((s) => s.status !== 'done')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            {done ? (
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
            ) : (
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
            )}
            <h2 className="font-semibold text-gray-900 text-base">
              {done ? 'Scan abgeschlossen' : 'Scan läuft…'}
            </h2>
          </div>
        </div>

        {/* Steps list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {visibleSteps.length === 0 && !connectionError && (
            <p className="text-sm text-gray-400 text-center py-6 animate-pulse">
              Verbinde mit Server…
            </p>
          )}

          {connectionError && (
            <div className="flex items-start gap-2.5">
              <span className="text-base shrink-0">❌</span>
              <p className="text-sm text-red-600">
                Verbindung zum Server konnte nicht hergestellt werden.
              </p>
            </div>
          )}

          {visibleSteps.map((step, i) => {
            const isLast = i === visibleSteps.length - 1 && !done
            return (
              <div key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5">
                  <StepIcon status={step.status} isLast={isLast} />
                </span>
                <p
                  className={`text-sm leading-5 ${
                    step.status === 'ok'
                      ? 'text-gray-800'
                      : step.status === 'error'
                      ? 'text-red-600'
                      : 'text-blue-700 font-medium'
                  }`}
                >
                  {step.message}
                </p>
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>

        {/* Footer – only when done */}
        {done && (
          <div className="px-5 py-3 border-t border-gray-100 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Fertig
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
