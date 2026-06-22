'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useEffect } from 'react'
import { DEFAULT_MAX_RENT, DEFAULT_SOURCE, TARGET_CITIES } from '@/lib/searchConfig'

const SOURCES = [
  { value: 'ebay', label: 'eBay Kleinanz.' },
]

const ROOM_OPTS = [
  { label: 'Alle',   min: '',  max: ''  },
  { label: '1 Zi',  min: '1', max: '1' },
  { label: '2 Zi',  min: '2', max: '2' },
  { label: '3 Zi',  min: '3', max: '3' },
  { label: '4 Zi',  min: '4', max: '4' },
  { label: '1-5 Zi', min: '1', max: '5' },
]

interface Props {
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function FilterSidebar({ mobileOpen, onMobileClose }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [maxPrice, setMaxPrice] = useState(Number(searchParams.get('max_price') || DEFAULT_MAX_RENT))
  const [minSqm, setMinSqm] = useState(Number(searchParams.get('min_sqm') || 25))
  const [maxSqm, setMaxSqm] = useState(Number(searchParams.get('max_sqm') || 140))
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([DEFAULT_SOURCE])
  const [roomsKey, setRoomsKey] = useState('1-5 Zi')

  useEffect(() => {
    const cityParam = searchParams.get('city')
    const sourceParam = searchParams.get('source')
    setSelectedCities(cityParam ? cityParam.split(',') : [])
    setSelectedSources(sourceParam ? sourceParam.split(',') : [DEFAULT_SOURCE])
    const minR = searchParams.get('min_rooms')
    const maxR = searchParams.get('max_rooms')
    if (minR && maxR) {
      const match = ROOM_OPTS.find(o => o.min === minR && o.max === maxR)
      setRoomsKey(match ? match.label : '1-5 Zi')
    }
  }, [searchParams])

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (maxPrice !== DEFAULT_MAX_RENT) params.set('max_price', String(maxPrice))
    if (minSqm !== 25) params.set('min_sqm', String(minSqm))
    if (maxSqm !== 140) params.set('max_sqm', String(maxSqm))
    const roomOpt = ROOM_OPTS.find(r => r.label === roomsKey)
    if (roomOpt?.min) params.set('min_rooms', roomOpt.min)
    if (roomOpt?.max) params.set('max_rooms', roomOpt.max)
    if (selectedCities.length > 0) params.set('city', selectedCities[0])
    if (selectedSources.length > 0 && selectedSources[0] !== DEFAULT_SOURCE) params.set('source', selectedSources[0])
    router.push(`/?${params.toString()}`)
    onMobileClose()
  }, [maxPrice, minSqm, maxSqm, roomsKey, selectedCities, selectedSources, router, onMobileClose])

  const reset = () => {
    setMaxPrice(DEFAULT_MAX_RENT)
    setMinSqm(25)
    setMaxSqm(140)
    setRoomsKey('1-5 Zi')
    setSelectedCities([])
    setSelectedSources([DEFAULT_SOURCE])
    router.push('/')
    onMobileClose()
  }

  const toggleCity = (city: string) =>
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    )

  const toggleSource = (source: string) =>
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    )

  const filterBody = (
    <>
      <div className="mb-5">
        <label className="text-xs font-medium text-gray-600 mb-1 block">
          Max. Kaltmiete: {new Intl.NumberFormat('de-DE').format(maxPrice)} €
        </label>
        <input
          type="range"
          min={300}
          max={1000}
          step={50}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>300 €</span>
          <span>1.000 €</span>
        </div>
      </div>

      <div className="mb-5">
        <label className="text-xs font-medium text-gray-600 mb-1 block">
          Wohnfläche: {minSqm} – {maxSqm} m²
        </label>
        <input
          type="range" min={20} max={160} step={5} value={minSqm}
          onChange={(e) => setMinSqm(Math.min(Number(e.target.value), maxSqm - 5))}
          className="w-full accent-blue-600 mb-1"
        />
        <input
          type="range" min={20} max={160} step={5} value={maxSqm}
          onChange={(e) => setMaxSqm(Math.max(Number(e.target.value), minSqm + 5))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>20 m²</span>
          <span>160 m²</span>
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs font-medium text-gray-600 mb-2">Zimmer</p>
        <div className="flex flex-wrap gap-1.5">
          {ROOM_OPTS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setRoomsKey(opt.label)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                roomsKey === opt.label
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs font-medium text-gray-600 mb-2">Städte</p>
        <div className="max-h-48 overflow-y-auto pr-1 space-y-1">
          {TARGET_CITIES.map((city) => (
            <label key={city} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCities.includes(city)}
                onChange={() => toggleCity(city)}
                className="accent-blue-600"
              />
              {city}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs font-medium text-gray-600 mb-2">Portale</p>
        {SOURCES.map((s) => (
          <label key={s.value} className="flex items-center gap-2 text-sm text-gray-700 mb-1 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedSources.includes(s.value)}
              onChange={() => toggleSource(s.value)}
              className="accent-blue-600"
            />
            {s.label}
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={applyFilters}
          className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Filter anwenden
        </button>
        <button
          onClick={reset}
          className="w-full py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Zurücksetzen
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white border border-gray-200 rounded-xl p-5 sticky top-6 self-start">
        <h2 className="font-semibold text-gray-900 mb-4">Filter</h2>
        {filterBody}
      </aside>

      {/* Mobile: slide-in modal */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          {/* Drawer */}
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h2 className="font-semibold text-gray-900">Filter</h2>
              <button
                onClick={onMobileClose}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {filterBody}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
