'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, X, SlidersHorizontal, MapPin, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Category } from '@/types'
import Chip from '@/components/ui/Chip'
import Tooltip from '@/components/ui/Tooltip'

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
// radius_km === 0 means "no filter" — the slider should sit at its max
// stop (50 km) to represent that, not some arbitrary middle value.
const MAX_DISTANCE_INDEX = DISTANCE_STOPS.length - 1

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
    <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-subtle mb-1.5">
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
    return idx >= 0 ? idx : MAX_DISTANCE_INDEX
  })

  useEffect(() => {
    if (filters.radius_km === 0) {
      setDistanceIndex(MAX_DISTANCE_INDEX)
      return
    }
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
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle pointer-events-none" />
        <input
          ref={searchRef}
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full pl-10 pr-10 py-2.5 bg-surface text-ink border border-border rounded-panel text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
        {filters.search && (
          <button
            onClick={() => { update('search', ''); searchRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink-muted transition-colors"
            aria-label={t('clearSearch')}
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
            <Chip selected={!filters.category} onClick={() => updateCategory('')}>
              {t('allCategories')}
            </Chip>
            {categories.map((c) => (
              <Chip
                key={c.key}
                selected={filters.category === c.key}
                icon={<span className="text-sm leading-none">{CATEGORY_ICONS[c.key] ?? DEFAULT_CATEGORY_ICON}</span>}
                onClick={() => updateCategory(filters.category === c.key ? '' : c.key)}
              >
                {c.label}
              </Chip>
            ))}
          </div>
          {/* Scroll hint */}
          <div className="pointer-events-none absolute top-0 right-0 bottom-0.5 w-8 bg-gradient-to-l from-bg to-transparent" />
        </div>

        {/* Subcategory — visually nested under the selected category */}
        {subcategoryOptions.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 ml-2 pl-2 border-l-2 border-border">
            <CornerDownRight className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0" />
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {subcategoryOptions.map((s) => (
                <Chip
                  key={s.key}
                  selected={filters.subcategory === s.key}
                  tone="subtle"
                  size="xs"
                  onClick={() => update('subcategory', filters.subcategory === s.key ? '' : s.key)}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Type + Distance + More filters */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <FilterLabel>{t('type')}</FilterLabel>
          <div className="flex bg-surface border border-border rounded-control overflow-hidden text-xs font-medium">
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
                    ? 'bg-primary text-primary-on'
                    : 'text-ink-muted hover:bg-surface-2'
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
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                {t('distance')}
              </span>
              <span className="text-xs font-medium text-ink-muted">
                {filters.radius_km > 0 ? t('upTo', { distance: formatDistanceLabel(filters.radius_km) }) : t('anyDistance')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 h-[30px]">
              <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-[10px] text-ink-subtle flex-shrink-0">100 m</span>
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
                className="w-full accent-primary cursor-pointer"
              />
              <span className="text-[10px] text-ink-subtle flex-shrink-0">50 km</span>
              {filters.radius_km > 0 && (
                <Tooltip label={t('clearDistance')}>
                  <button
                    type="button"
                    onClick={() => update('radius_km', 0)}
                    className="flex-shrink-0 text-ink-subtle hover:text-danger transition-colors"
                    aria-label={t('clearDistance')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        ) : userHasZip ? (
          <span className="text-xs text-ink-subtle flex items-center gap-1 pb-1.5">
            <MapPin className="w-3 h-3" /> {t('calculatingLocation')}
          </span>
        ) : isAuthenticated ? (
          <a href="/profile" className="text-xs text-ink-subtle flex items-center gap-1 hover:text-primary transition-colors pb-1.5">
            <MapPin className="w-3 h-3" />
            {t('addZipToFilter')}
          </a>
        ) : (
          <a href="/login?redirect=/items" className="text-xs text-ink-subtle flex items-center gap-1 hover:text-primary transition-colors pb-1.5">
            <MapPin className="w-3 h-3" />
            {t('loginToFilter')}
          </a>
        )}

        {/* More filters toggle */}
        <button
          onClick={() => setShowLocation(!showLocation)}
          className={`ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-control border transition-colors ${
            secondaryActiveCount > 0
              ? 'border-primary/40 text-primary bg-primary-subtle'
              : 'border-border text-ink-muted bg-surface hover:border-border-strong'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {t('moreFilters')}
          {secondaryActiveCount > 0 && (
            <span className="bg-primary text-primary-on text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {secondaryActiveCount}
            </span>
          )}
          {showLocation ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expandable — Neighborhood + City */}
      {showLocation && (
        <div className="grid grid-cols-2 gap-2 p-3 bg-surface-2 rounded-panel border border-border">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">{t('neighborhood')}</label>
            <input
              value={filters.neighborhood}
              onChange={(e) => update('neighborhood', e.target.value)}
              placeholder={t('neighborhoodPlaceholder')}
              className="w-full border border-border bg-surface text-ink rounded-control px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">{t('city')}</label>
            <input
              value={filters.city}
              onChange={(e) => update('city', e.target.value)}
              placeholder={t('cityPlaceholder')}
              className="w-full border border-border bg-surface text-ink rounded-control px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {(filters.category || filters.subcategory || filters.availability_type || filters.neighborhood || filters.city || filters.radius_km > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-subtle">{t('filters')}</span>
          {filters.category && (() => {
            const label = `${CATEGORY_ICONS[filters.category] ?? DEFAULT_CATEGORY_ICON} ${categories.find((c) => c.key === filters.category)?.label ?? filters.category}`
            return (
              <Chip tone="subtle" size="xs" onRemove={() => updateCategory('')} removeLabel={t('removeFilter', { label })}>
                {label}
              </Chip>
            )
          })()}
          {filters.subcategory && (() => {
            const label = subcategoryOptions.find((s) => s.key === filters.subcategory)?.label ?? filters.subcategory
            return (
              <Chip tone="subtle" size="xs" onRemove={() => update('subcategory', '')} removeLabel={t('removeFilter', { label })}>
                {label}
              </Chip>
            )
          })()}
          {filters.availability_type && (() => {
            const label = filters.availability_type === 'free' ? t('free') : t('paid')
            return (
              <Chip tone="subtle" size="xs" onRemove={() => update('availability_type', '')} removeLabel={t('removeFilter', { label })}>
                {label}
              </Chip>
            )
          })()}
          {filters.neighborhood && (
            <Chip tone="subtle" size="xs" onRemove={() => update('neighborhood', '')} removeLabel={t('removeFilter', { label: filters.neighborhood })}>
              {filters.neighborhood}
            </Chip>
          )}
          {filters.city && (
            <Chip tone="subtle" size="xs" onRemove={() => update('city', '')} removeLabel={t('removeFilter', { label: filters.city })}>
              {filters.city}
            </Chip>
          )}
          {filters.radius_km > 0 && (() => {
            const label = t('upTo', { distance: formatDistanceLabel(filters.radius_km) })
            return (
              <Chip tone="subtle" size="xs" onRemove={() => update('radius_km', 0)} removeLabel={t('removeFilter', { label })}>
                {label}
              </Chip>
            )
          })()}
          <button onClick={reset} className="text-xs text-danger hover:text-danger ml-1 transition-colors">
            {t('clearAll')}
          </button>
        </div>
      )}
    </div>
  )
}
