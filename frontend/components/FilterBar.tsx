'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react'
import { DEFAULT_MAX_RENT, TARGET_CITIES } from '@/lib/searchConfig'

const SOURCES = [
  { value: 'ebay', label: 'eBay Kleinanz.' },
  { value: 'immowelt', label: 'Immowelt' },
]

const PRICE_OPTIONS = [
  { label: 'bis 550 €', value: '550' },
  { label: 'bis 750 €', value: '750' },
  { label: 'bis 1.000 €', value: '1000' },
  { label: 'bis 1.250 €', value: '1250' },
  { label: 'bis 1.500 €', value: '1500' },
  { label: 'bis 2.000 €', value: '2000' },
]

const SIZE_OPTIONS = [
  { label: 'Alle Größen', value: 'all', minSqm: '', maxSqm: '' },
  { label: '25 – 60 m²', value: '25-60', minSqm: '25', maxSqm: '60' },
  { label: '40 – 90 m²', value: '40-90', minSqm: '40', maxSqm: '90' },
  { label: '60 – 120 m²', value: '60-120', minSqm: '60', maxSqm: '120' },
  { label: '25 – 140 m²', value: '25-140', minSqm: '25', maxSqm: '140' },
]

function MultiDropdown({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const display = selected.length > 0
    ? selected.length === 1 ? options.find(o => o.value === selected[0])?.label ?? label : `${selected.length} ausgewählt`
    : label

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-all duration-200 whitespace-nowrap ${
          selected.length > 0
            ? 'border-primary bg-primary/5 dark:bg-primary/10 text-primary dark:text-blue-400 font-medium'
            : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-slate-500'
        }`}
      >
        {display}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg min-w-[180px] py-1 animate-slide-up">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer text-sm text-gray-700 dark:text-gray-300"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="accent-primary rounded"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FilterBar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const defaultMaxRent = String(DEFAULT_MAX_RENT)
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || defaultMaxRent)
  const [sizeKey, setSizeKey] = useState('all')
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])

  useEffect(() => {
    const city = searchParams.get('city')
    const source = searchParams.get('source')
    setSelectedCities(city ? city.split(',') : [])
    setSelectedSources(source ? source.split(',') : [])
    setMaxPrice(searchParams.get('max_price') || defaultMaxRent)
    const minSqm = searchParams.get('min_sqm')
    const maxSqm = searchParams.get('max_sqm')
    const matchingSize = SIZE_OPTIONS.find((s) => s.minSqm === (minSqm || '') && s.maxSqm === (maxSqm || ''))
    setSizeKey(matchingSize?.value || 'all')
  }, [defaultMaxRent, searchParams])

  const hasFilters = selectedCities.length > 0 || selectedSources.length > 0 ||
    maxPrice !== defaultMaxRent || sizeKey !== 'all'

  const apply = useCallback(() => {
    const params = new URLSearchParams()
    if (maxPrice && maxPrice !== defaultMaxRent) params.set('max_price', maxPrice)
    const size = SIZE_OPTIONS.find(s => s.value === sizeKey)
    if (size?.minSqm) params.set('min_sqm', size.minSqm)
    if (size?.maxSqm) params.set('max_sqm', size.maxSqm)
    if (selectedCities.length > 0) params.set('city', selectedCities[0])
    if (selectedSources.length > 0) params.set('source', selectedSources[0])
    router.push(`/?${params.toString()}`)
  }, [defaultMaxRent, maxPrice, sizeKey, selectedCities, selectedSources, router])

  const reset = () => {
    setMaxPrice(defaultMaxRent)
    setSizeKey('all')
    setSelectedCities([])
    setSelectedSources([])
    router.push('/')
  }

  const toggleCity = (c: string) =>
    setSelectedCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  const toggleSource = (s: string) =>
    setSelectedSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <SlidersHorizontal size={15} className="text-gray-400 dark:text-slate-500 shrink-0" />

        {/* Price */}
        <select
          value={maxPrice}
          onChange={e => { setMaxPrice(e.target.value); }}
          onBlur={apply}
          className={`px-3 py-2 rounded-xl text-sm border cursor-pointer transition-all duration-200 bg-white dark:bg-slate-800 ${
            maxPrice !== defaultMaxRent
              ? 'border-primary text-primary dark:text-blue-400 font-medium'
              : 'border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          {PRICE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Size */}
        <select
          value={sizeKey}
          onChange={e => setSizeKey(e.target.value)}
          onBlur={apply}
          className="px-3 py-2 rounded-xl text-sm border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 cursor-pointer transition-all duration-200"
        >
          {SIZE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* City multi-select */}
        <MultiDropdown
          label="Alle Städte"
          options={TARGET_CITIES.map(c => ({ value: c, label: c }))}
          selected={selectedCities}
          onToggle={(c) => { toggleCity(c); }}
        />

        {/* Source multi-select */}
        <MultiDropdown
          label="Alle Portale"
          options={SOURCES}
          selected={selectedSources}
          onToggle={(s) => { toggleSource(s); }}
        />

        {/* Apply */}
        <button onClick={apply} className="btn-primary shrink-0">
          Anwenden
        </button>

        {/* Reset */}
        {hasFilters && (
          <button
            onClick={reset}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200"
          >
            <X size={13} /> Zurücksetzen
          </button>
        )}
      </div>
    </div>
  )
}
