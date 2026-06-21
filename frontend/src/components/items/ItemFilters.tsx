'use client'
import { useState, useRef } from 'react'
import { Search, X, SlidersHorizontal, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { CATEGORIES } from '@/types'

export interface Filters {
  search: string
  category: string
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
}

const RADIUS_OPTIONS = [
  { value: 1, label: '1 km' },
  { value: 2, label: '2 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 20, label: '20 km' },
  { value: 50, label: '50 km' },
]

const CATEGORY_ICONS: Record<string, string> = {
  tools: '🔧', electronics: '💻', sports: '⚽', garden: '🌱',
  kitchen: '🍳', books: '📚', toys: '🎮', clothing: '👕',
  furniture: '🛋️', other: '📦',
}

export default function ItemFilters({ filters, onChange, userHasLocation, userHasZip }: Props) {
  const [showLocation, setShowLocation] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const update = (key: keyof Filters, value: string | number) =>
    onChange({ ...filters, [key]: value })

  const reset = () =>
    onChange({ search: '', category: '', availability_type: '', neighborhood: '', city: '', radius_km: 0 })

  const activeCount = [
    filters.availability_type,
    filters.neighborhood,
    filters.city,
    filters.radius_km > 0 ? '1' : '',
  ].filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* Row 1 — Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={searchRef}
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          placeholder="Buscar por nome do item..."
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
        />
        {filters.search && (
          <button
            onClick={() => { update('search', ''); searchRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Row 2 — Category pills (scrollable) */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        <button
          onClick={() => update('category', '')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
            !filters.category
              ? 'bg-green-600 text-white border-green-600 shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700'
          }`}
        >
          Todos
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => update('category', filters.category === c.value ? '' : c.value)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filters.category === c.value
                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700'
            }`}
          >
            <span className="text-sm leading-none">{CATEGORY_ICONS[c.value]}</span>
            {c.label}
          </button>
        ))}
      </div>

      {/* Row 3 — Type + Distance (always visible) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type toggle */}
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm text-xs font-medium">
          {[
            { value: '', label: 'Qualquer tipo' },
            { value: 'free', label: 'Gratuito' },
            { value: 'paid', label: 'Pago' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => update('availability_type', opt.value)}
              className={`px-3 py-1.5 transition-colors ${
                filters.availability_type === opt.value
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200" />

        {/* Distance */}
        {userHasLocation ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <MapPin className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            {[{ value: 0, label: 'Qualquer' }, ...RADIUS_OPTIONS].map((opt) => (
              <button
                key={opt.value}
                onClick={() => update('radius_km', opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filters.radius_km === opt.value
                    ? 'bg-green-600 text-white border-green-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : userHasZip ? (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Calculando localização…
          </span>
        ) : (
          <a href="/profile" className="text-xs text-gray-400 flex items-center gap-1 hover:text-green-600 transition-colors">
            <MapPin className="w-3 h-3" />
            Adicione seu CEP para filtrar por distância
          </a>
        )}

        {/* Location text filter toggle */}
        <button
          onClick={() => setShowLocation(!showLocation)}
          className={`ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            filters.neighborhood || filters.city
              ? 'border-green-400 text-green-700 bg-green-50'
              : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Bairro / Cidade
          {showLocation ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expandable — Neighborhood + City */}
      {showLocation && (
        <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bairro</label>
            <input
              value={filters.neighborhood}
              onChange={(e) => update('neighborhood', e.target.value)}
              placeholder="Ex: Vila Madalena"
              className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cidade</label>
            <input
              value={filters.city}
              onChange={(e) => update('city', e.target.value)}
              placeholder="Ex: São Paulo"
              className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {(filters.category || filters.availability_type || filters.neighborhood || filters.city || filters.radius_km > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400">Filtros:</span>
          {filters.category && (
            <Chip label={`${CATEGORY_ICONS[filters.category]} ${CATEGORIES.find(c => c.value === filters.category)?.label}`} onRemove={() => update('category', '')} />
          )}
          {filters.availability_type && (
            <Chip label={filters.availability_type === 'free' ? 'Gratuito' : 'Pago'} onRemove={() => update('availability_type', '')} />
          )}
          {filters.neighborhood && (
            <Chip label={filters.neighborhood} onRemove={() => update('neighborhood', '')} />
          )}
          {filters.city && (
            <Chip label={filters.city} onRemove={() => update('city', '')} />
          )}
          {filters.radius_km > 0 && (
            <Chip label={`até ${filters.radius_km} km`} onRemove={() => update('radius_km', 0)} />
          )}
          <button onClick={reset} className="text-xs text-red-500 hover:text-red-700 ml-1 transition-colors">
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-green-900 transition-colors ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
