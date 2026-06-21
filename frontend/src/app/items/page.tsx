'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Package } from 'lucide-react'
import { Item } from '@/types'
import { itemsService } from '@/services/items'
import { useAuth } from '@/contexts/AuthContext'
import { haversineKm } from '@/lib/utils'
import ItemCard from '@/components/items/ItemCard'
import ItemFilters, { Filters } from '@/components/items/ItemFilters'
import EmptyState from '@/components/ui/EmptyState'

const LIMIT = 16

const INITIAL_FILTERS: Filters = {
  search: '',
  category: '',
  availability_type: '',
  neighborhood: '',
  city: '',
  radius_km: 0,
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-[4/3] bg-gray-200" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-4 w-20 bg-gray-200 rounded-md" />
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-3/4 bg-gray-200 rounded" />
        <div className="pt-2 border-t border-gray-100 flex justify-between">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-3 w-8 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}

export default function ItemsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const loaderRef = useRef<HTMLDivElement>(null)
  const skipRef = useRef(0)
  const isFetchingRef = useRef(false)
  const hasMoreRef = useRef(true)

  const userHasLocation = !!(user?.latitude && user?.longitude)
  const userHasZip = !!user?.zip_code

  const buildParams = useCallback((skip: number) => {
    const p: Record<string, string | number> = { skip, limit: LIMIT }
    if (filters.search) p.search = filters.search
    if (filters.category) p.category = filters.category
    if (filters.availability_type) p.availability_type = filters.availability_type
    if (filters.neighborhood) p.neighborhood = filters.neighborhood
    if (filters.city) p.city = filters.city
    if (filters.radius_km > 0 && userHasLocation) {
      p.lat = user!.latitude!
      p.lng = user!.longitude!
      p.radius_km = filters.radius_km
    }
    return p
  }, [filters, user, userHasLocation])

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMoreRef.current) return
    isFetchingRef.current = true
    setLoadingMore(true)
    try {
      const data = await itemsService.list(buildParams(skipRef.current) as any)
      setItems((prev) => [...prev, ...data])
      skipRef.current += data.length
      hasMoreRef.current = data.length === LIMIT
      setHasMore(data.length === LIMIT)
    } finally {
      isFetchingRef.current = false
      setLoadingMore(false)
    }
  }, [buildParams])

  // Reset and initial load when filters change
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      skipRef.current = 0
      hasMoreRef.current = true
      isFetchingRef.current = true
      setInitialLoading(true)
      setHasMore(true)
      try {
        const data = await itemsService.list(buildParams(0) as any)
        if (cancelled) return
        setItems(data)
        skipRef.current = data.length
        hasMoreRef.current = data.length === LIMIT
        setHasMore(data.length === LIMIT)
      } finally {
        if (!cancelled) {
          isFetchingRef.current = false
          setInitialLoading(false)
        }
      }
    }

    const timer = setTimeout(run, filters.search ? 350 : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [filters, buildParams])

  // Infinite scroll via IntersectionObserver
  // Re-run when loadMore changes (filter change) OR when initialLoading
  // flips to false (loaderRef div enters the DOM for the first time)
  useEffect(() => {
    if (initialLoading) return
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, initialLoading])

  const getDistance = (item: Item): number | undefined => {
    if (!userHasLocation || !item.latitude || !item.longitude) return undefined
    return haversineKm(user!.latitude!, user!.longitude!, item.latitude, item.longitude)
  }

  const hasActiveFilters = !!(filters.search || filters.category || filters.availability_type ||
    filters.neighborhood || filters.city || filters.radius_km > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Explorar itens</h1>
          <p className="text-gray-500 text-sm">
            {userHasLocation && user?.city
              ? `Encontre objetos disponíveis perto de você em ${user.city}`
              : 'Encontre objetos disponíveis para empréstimo na sua região'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <ItemFilters
            filters={filters}
            onChange={setFilters}
            userHasLocation={userHasLocation}
            userHasZip={userHasZip}
          />
        </div>

        {/* Results */}
        {initialLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: LIMIT }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum item encontrado"
            description={
              filters.radius_km > 0
                ? `Nenhum item a ${filters.radius_km} km de você. Tente aumentar o raio.`
                : hasActiveFilters
                ? 'Nenhum resultado para os filtros aplicados. Tente ajustá-los.'
                : 'Ainda não há itens cadastrados. Seja o primeiro a cadastrar um!'
            }
          />
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">
              <span className="text-gray-700 font-medium">{items.length}</span> item{items.length !== 1 ? 's' : ''} carregado{items.length !== 1 ? 's' : ''}
              {filters.radius_km > 0 && (
                <span className="text-green-600"> · a até {filters.radius_km} km de você</span>
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} distanceKm={getDistance(item)} />
              ))}

              {/* Skeleton cards while loading more */}
              {loadingMore && Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={`more-${i}`} />
              ))}
            </div>

            {/* Scroll trigger */}
            <div ref={loaderRef} className="h-4 mt-4" />

            {!hasMore && items.length > LIMIT && (
              <p className="text-center text-sm text-gray-400 mt-6">
                Todos os itens foram carregados.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
