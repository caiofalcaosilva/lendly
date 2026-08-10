'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, X, SlidersHorizontal, MapPin, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Category } from '@/types'

export interface Filters {
  search: string
  category: string
  subcategory: string
  availability_type: string
  neighborhood: string
  city: string
  radius_km: number
}

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  userHasLocation: boolean
  userHasZip: boolean
  isAuthenticated: boolean
  categories: Category[]
}

// Non-linear stops (finer-grained near "just my street", coarser further
// out) — a plain linear 100m–50km slider would make the sub-1km range
// impossible to hit precisely with a mouse/finger.
const DISTANCE_STOPS = [0.1, 0.25, 0.5, 0.75, 1, 2, 3, 5, 7, 10, 15, 20, 30, 40, 50]
const DEFAULT_DISTANCE_INDEX = DISTANCE_STOPS.indexOf(5)

function formatDistanceLabel(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`
}

const CATEGORY_ICONS: Record<string, string> = {
  tools: '🔧', electronics: '💻', sports: '⚽', garden: '🌱',
  kitchen: '🍳', books: '📚', toys: '🎮', clothing: '👕',
  furniture: '🛋️', other: '📦',
}
const DEFAULT_CATEGORY_ICON = '📦'

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
      {children}
    </span>
  )
}

export default function ItemFilters({ filters, onChange, userHasLocation, userHasZip, isAuthenticated, categories }: Props) {
  const [showLocation, setShowLocation] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const t = useTranslations('Common.ItemFilters')

  // Slider thumb position is tracked separately from filters.radius_km so
  // it has somewhere sensible to sit before the user has touched it (0 km
  // means "no filter", not "leftmost stop") — but stays in sync whenever
  // radius_km changes from outside (e.g. cleared via a filter chip).
  const [distanceIndex, setDistanceIndex] = useState(() => {
    const idx = DISTANCE_STOPS.indexOf(filters.radius_km)
    return idx >= 0 ? idx : DEFAULT_DISTANCE_INDEX
  })

  useEffect(() => {
    if (filters.radius_km === 0) return
    const idx = DISTANCE_STOPS.indexOf(filters.radius_km)
    if (idx >= 0) setDistanceIndex(idx)
  }, [filters.radius_km])

  const update = (key: keyof Filters, value: string | number) =>
    onChange({ ...filters, [key]: value })

  const updateCategory = (value: string) =>
    onChange({ ...filters, category: value, subcategory: '' })

  const reset = () =>
    onChange({
      search: '', category: '', subcategory: '', availability_type: '',
      neighborhood: '', city: '', radius_km: 0,
    })

  const subcategoryOptions = filters.category
    ? categories.find((c) => c.key === filters.category)?.subcategories ?? []
    : []

  const secondaryActiveCount = [filters.neighborhood, filters.city].filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
        <input
          ref={searchRef}
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
        />
        {filters.search && (
          <button
            onClick={() => { update('search', ''); searchRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category */}
      <div>
        <FilterLabel>{t('category')}</FilterLabel>
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-0.5 pr-6 scrollbar-hide">
            <button
              onClick={() => updateCategory('')}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                !filters.category
                  ? 'bg-green-600 text-white border-green-600 shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-600 hover:text-green-700 dark:hover:text-green-400'
              }`}
            >
              {t('allCategories')}
            </button>
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => updateCategory(filters.category === c.key ? '' : c.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filters.category === c.key
                    ? 'bg-green-600 text-white border-green-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-600 hover:text-green-700 dark:hover:text-green-400'
                }`}
              >
                <span className="text-sm leading-none">{CATEGORY_ICONS[c.key] ?? DEFAULT_CATEGORY_ICON}</span>
                {c.label}
              </button>
            ))}
          </div>
          {/* Scroll hint */}
          <div className="pointer-events-none absolute top-0 right-0 bottom-0.5 w-8 bg-gradient-to-l from-gray-50 dark:from-gray-900 to-transparent" />
        </div>

        {/* Subcategory — visually nested under the selected category */}
        {subcategoryOptions.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 ml-2 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
            <CornerDownRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {subcategoryOptions.map((s) => (
                <button
                  key={s.key}
                  onClick={() => update('subcategory', filters.subcategory === s.key ? '' : s.key)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    filters.subcategory === s.key
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700'
                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 hover:text-green-700 dark:hover:text-green-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Type + Distance + More filters */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <FilterLabel>{t('type')}</FilterLabel>
          <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm text-xs font-medium">
            {[
              { value: '', label: t('anyType') },
              { value: 'free', label: t('free') },
              { value: 'paid', label: t('paid') },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => update('availability_type', opt.value)}
                className={`px-3 py-1.5 transition-colors ${
                  filters.availability_type === opt.value
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {userHasLocation ? (
          <div className="min-w-[200px]">
            <div className="flex items-center justify-between mb-1.5">
              <FilterLabel>{t('distance')}</FilterLabel>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 -mt-1.5">
                {filters.radius_km > 0 ? t('upTo', { distance: formatDistanceLabel(filters.radius_km) }) : t('anyDistance')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <input
                type="range"
                min={0}
                max={DISTANCE_STOPS.length - 1}
                step={1}
                value={distanceIndex}
                onChange={(e) => {
                  const idx = Number(e.target.value)
                  setDistanceIndex(idx)
                  update('radius_km', DISTANCE_STOPS[idx])
                }}
                className="w-full accent-green-600 cursor-pointer"
              />
              {filters.radius_km > 0 && (
                <button
                  type="button"
                  onClick={() => update('radius_km', 0)}
                  className="flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title={t('clearDistance')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex justify-between text-[10px] text-gray-300 dark:text-gray-600 mt-0.5 px-5">
              <span>100 m</span>
              <span>50 km</span>
            </div>
          </div>
        ) : userHasZip ? (
          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 pb-1.5">
            <MapPin className="w-3 h-3" /> {t('calculatingLocation')}
          </span>
        ) : isAuthenticated ? (
          <a href="/profile" className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 hover:text-green-600 dark:hover:text-green-400 transition-colors pb-1.5">
            <MapPin className="w-3 h-3" />
            {t('addZipToFilter')}
          </a>
        ) : (
          <a href="/login?redirect=/items" className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 hover:text-green-600 dark:hover:text-green-400 transition-colors pb-1.5">
            <MapPin className="w-3 h-3" />
            {t('loginToFilter')}
          </a>
        )}

        {/* More filters toggle */}
        <button
          onClick={() => setShowLocation(!showLocation)}
          className={`ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            secondaryActiveCount > 0
              ? 'border-green-400 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {t('moreFilters')}
          {secondaryActiveCount > 0 && (
            <span className="bg-green-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {secondaryActiveCount}
            </span>
          )}
          {showLocation ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expandable — Neighborhood + City */}
      {showLocation && (
        <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('neighborhood')}</label>
            <input
              value={filters.neighborhood}
              onChange={(e) => update('neighborhood', e.target.value)}
              placeholder={t('neighborhoodPlaceholder')}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('city')}</label>
            <input
              value={filters.city}
              onChange={(e) => update('city', e.target.value)}
              placeholder={t('cityPlaceholder')}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {(filters.category || filters.subcategory || filters.availability_type || filters.neighborhood || filters.city || filters.radius_km > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400 dark:text-gray-500">{t('filters')}</span>
          {filters.category && (
            <Chip
              label={`${CATEGORY_ICONS[filters.category] ?? DEFAULT_CATEGORY_ICON} ${categories.find((c) => c.key === filters.category)?.label ?? filters.category}`}
              onRemove={() => updateCategory('')}
            />
          )}
          {filters.subcategory && (
            <Chip
              label={subcategoryOptions.find((s) => s.key === filters.subcategory)?.label ?? filters.subcategory}
              onRemove={() => update('subcategory', '')}
            />
          )}
          {filters.availability_type && (
            <Chip label={filters.availability_type === 'free' ? t('free') : t('paid')} onRemove={() => update('availability_type', '')} />
          )}
          {filters.neighborhood && (
            <Chip label={filters.neighborhood} onRemove={() => update('neighborhood', '')} />
          )}
          {filters.city && (
            <Chip label={filters.city} onRemove={() => update('city', '')} />
          )}
          {filters.radius_km > 0 && (
            <Chip label={t('upTo', { distance: formatDistanceLabel(filters.radius_km) })} onRemove={() => update('radius_km', 0)} />
          )}
          <button onClick={reset} className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-1 transition-colors">
            {t('clearAll')}
          </button>
        </div>
      )}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-full text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-green-900 dark:hover:text-green-100 transition-colors ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
