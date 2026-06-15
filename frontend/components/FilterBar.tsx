'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react'

const CITIES = [
  'Paderborn', 'Gütersloh', 'Bielefeld', 'Herford', 'Rheda-Wiedenbrück', 'Bad Oeynhausen',
  'Detmold', 'Lippstadt', 'Soest', 'Hamm',
  'Minden', 'Bünde', 'Löhne', 'Bad Salzuflen', 'Lemgo',
]

const SOURCES = [
  { value: 'ebay', label: 'eBay Kleinanz.' },
  { value: 'immowelt', label: 'Immowelt' },
  { value: 'immonet', label: 'Immonet' },
]

const PRICE_OPTIONS = [
  { label: 'bis 100.000 €', value: '100000' },
  { label: 'bis 150.000 €', value: '150000' },
  { label: 'bis 175.000 €', value: '175000' },
  { label: 'bis 195.000 €', value: '195000' },
  { label: 'bis 250.000 €', value: '250000' },
]

const SIZE_OPTIONS = [
  { label: 'Alle Größen', minSqm: '', maxSqm: '' },
  { label: '40 – 80 m²', minSqm: '40', maxSqm: '80' },
  { label: '60 – 100 m²', minSqm: '60', maxSqm: '100' },
  { label: '60 – 130 m²', minSqm: '60', maxSqm: '130' },
  { label: '80 – 150 m²', minSqm: '80', maxSqm: '150' },
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

  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '195000')
  const [sizeKey, setSizeKey] = useState('60-130')
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])

  useEffect(() => {
    const city = searchParams.get('city')
    const source = searchParams.get('source')
    setSelectedCities(city ? city.split(',') : [])
    setSelectedSources(source ? source.split(',') : [])
    setMaxPrice(searchParams.get('max_price') || '195000')
  }, [searchParams])

  const hasFilters = selectedCities.length > 0 || selectedSources.length > 0 ||
    maxPrice !== '195000' || sizeKey !== '60-130'

  const apply = useCallback(() => {
    const params = new URLSearchParams()
    if (maxPrice && maxPrice !== '195000') params.set('max_price', maxPrice)
    const size = SIZE_OPTIONS.find(s => s.label.includes(sizeKey))
    if (size?.minSqm) params.set('min_sqm', size.minSqm)
    if (size?.maxSqm) params.set('max_sqm', size.maxSqm)
    if (selectedCities.length > 0) params.set('city', selectedCities[0])
    if (selectedSources.length > 0) params.set('source', selectedSources[0])
    router.push(`/?${params.toString()}`)
  }, [maxPrice, sizeKey, selectedCities, selectedSources, router])

  const reset = () => {
    setMaxPrice('195000')
    setSizeKey('60-130')
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
            maxPrice !== '195000'
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
            <option key={o.label} value={o.label.includes('–') ? o.label.split(' – ')[0].replace('40', '40').split('').filter(c => /\d/.test(c)).join('') + '-' + o.label.split('– ')[1].split(' m')[0] : 'all'}>
              {o.label}
            </option>
          ))}
        </select>

        {/* City multi-select */}
        <MultiDropdown
          label="Alle Städte"
          options={CITIES.map(c => ({ value: c, label: c }))}
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
