'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import ScanProgress from './ScanProgress'

export default function ScanButton() {
  const [showProgress, setShowProgress] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowProgress(true)}
        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-xl shadow-sm transition-all duration-200 active:scale-95"
      >
        <Search size={15} />
        <span className="hidden sm:block">Scan starten</span>
      </button>
      <ScanProgress open={showProgress} onClose={() => setShowProgress(false)} />
    </>
  )
}
