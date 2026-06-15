'use client'

import { useState } from 'react'
import ScanProgress from './ScanProgress'

interface Props {
  lastScan: string | null
}

export default function ScanButton({ lastScan }: Props) {
  const [showProgress, setShowProgress] = useState(false)

  return (
    <>
      <div className="flex items-center gap-3">
        {lastScan && (
          <span className="text-xs text-gray-400 hidden sm:block">
            Letzter Scan:{' '}
            {new Date(lastScan).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
        <button
          onClick={() => setShowProgress(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔍 Jetzt scannen
        </button>
      </div>

      <ScanProgress open={showProgress} onClose={() => setShowProgress(false)} />
    </>
  )
}
