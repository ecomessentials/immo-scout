'use client'

import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle, XCircle, Loader2, Search } from 'lucide-react'

interface Step {
  status: 'ok' | 'error' | 'info' | 'done'
  message: string
}

interface Props {
  open: boolean
  onClose: () => void
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
// 4 scrapers × 15 cities × 2 steps each + ~8 summary steps
const EXPECTED_STEPS = 128

function StepRow({ step, isLast, isDone }: { step: Step; isLast: boolean; isDone: boolean }) {
  const pulsing = step.status === 'info' && isLast && !isDone
  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <span className="shrink-0 mt-0.5">
        {step.status === 'ok' && <CheckCircle size={16} className="text-emerald-500" />}
        {step.status === 'error' && <XCircle size={16} className="text-red-500" />}
        {step.status === 'info' && (
          <Loader2 size={16} className={`text-blue-500 ${pulsing ? 'animate-spin' : ''}`} />
        )}
      </span>
      <p className={`text-sm leading-5 ${
        step.status === 'ok' ? 'text-gray-800 dark:text-gray-200' :
        step.status === 'error' ? 'text-red-600 dark:text-red-400' :
        'text-blue-700 dark:text-blue-400 font-medium'
      }`}>
        {step.message}
      </p>
    </div>
  )
}

export default function ScanProgress({ open, onClose }: Props) {
  const [steps, setSteps] = useState<Step[]>([])
  const [done, setDone] = useState(false)
  const [connError, setConnError] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!open) {
      esRef.current?.close()
      esRef.current = null
      setSteps([])
      setDone(false)
      setConnError(false)
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
          return
        }
        setSteps((prev) => [...prev, event])
      } catch { /* ignore */ }
    }

    es.onerror = () => {
      setConnError(true)
      setDone(true)
      es.close()
    }

    return () => { es.close() }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps])

  if (!open) return null

  const visibleSteps = steps.filter((s) => s.status !== 'done')
  const progress = done ? 100 : Math.min(95, Math.round((visibleSteps.length / EXPECTED_STEPS) * 100))
  const summary = visibleSteps.findLast((s) => s.message.includes('Scan abgeschlossen'))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden" style={{ maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            {done
              ? <CheckCircle size={20} className="text-emerald-500" />
              : <Search size={20} className="text-primary animate-pulse" />
            }
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                {done ? 'Scan abgeschlossen' : 'Scan läuft…'}
              </h2>
              {done && summary && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{summary.message}</p>
              )}
            </div>
          </div>
          {done && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-all">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-slate-700 shrink-0">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {visibleSteps.length === 0 && !connError && (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8 animate-pulse">
              Verbinde mit Server…
            </p>
          )}
          {connError && (
            <div className="flex items-start gap-3">
              <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">
                Verbindung zum Backend konnte nicht hergestellt werden.
              </p>
            </div>
          )}
          {visibleSteps.map((step, i) => (
            <StepRow
              key={i}
              step={step}
              isLast={i === visibleSteps.length - 1}
              isDone={done}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        {done && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 shrink-0 flex justify-end">
            <button onClick={onClose} className="btn-primary">
              Fertig
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
