'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from '@/i18n/navigation'
import { Package, List, Map as MapIcon, MapPin, LocateFixed, AlertTriangle, RotateCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Category, Item } from '@/types'
import { itemsService } from '@/services/items'
import { categoriesService } from '@/services/categories'
import { useAuth } from '@/contexts/AuthContext'
import { haversineKm } from '@/lib/utils'
import ItemCard from '@/components/items/ItemCard'
import ItemFilters, { Filters } from '@/components/items/ItemFilters'
import EmptyState from '@/components/ui/EmptyState'

function MapLoading() {
  const t = useTranslations('Items')
  return (
    <div className="h-[600px] flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-2xl">
      {t('loadingMap')}
    </div>
  )
}

const ItemsMapView = dynamic(() => import('@/components/items/ItemsMapView'), {
  ssr: false,
  loading: MapLoading,
})

const LIMIT = 16
const MAP_LIMIT = 100
const NEARBY_LIMIT = 8

// A lightweight, separate "feed" row — the nearest available items,
// regardless of category — shown above the searchable grid so a logged-in
// user with a known location sees something personalized without having to
// touch a single filter. Sorted client-side by exact distance since the
// backend's radius filter only bounds results, it doesn't order by distance.
// Accepts up to two origins (home address + live location) — same union
// rule as the main search.
async function loadNearbyItems(
  origin: { lat: number; lng: number },
  origin2?: { lat: number; lng: number },
): Promise<Item[]> {
  const results = await itemsService.list({
    lat: origin.lat,
    lng: origin.lng,
    ...(origin2 ? { lat2: origin2.lat, lng2: origin2.lng } : {}),
    radius_km: 50,
    limit: 30,
  } as any)
  const distanceTo = (item: Item) => {
    if (item.latitude == null || item.longitude == null) return Infinity
    const d1 = haversineKm(origin.lat, origin.lng, item.latitude, item.longitude)
    const d2 = origin2 ? haversineKm(origin2.lat, origin2.lng, item.latitude, item.longitude) : Infinity
    return Math.min(d1, d2)
  }
  return results
    .map((item) => ({ item, distance: distanceTo(item) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, NEARBY_LIMIT)
    .map((x) => x.item)
}

type LiveLocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported'

// Requests the browser's live location — falls back to the profile
// address alone on denial/error, but surfaces enough status for the UI to
// show "localizando..." while waiting and a manual retry afterward
// (there's no other way to re-trigger a denied permission prompt).
function useLiveLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState<LiveLocationStatus>('idle')

  const request = useCallback(() => {
    if (!navigator.geolocation) { setStatus('unsupported'); return }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus('granted')
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
  }, [])

  useEffect(() => { request() }, [request])

  return { location, status, retry: request }
}

const INITIAL_FILTERS: Filters = {
  search: '',
  category: '',
  subcategory: '',
  availability_type: '',
  neighborhood: '',
  city: '',
  radius_km: 0,
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-700" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-md" />
        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between">
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  )
}

interface Props {
  initialItems: Item[]
  initialFilters: Partial<Filters>
}

export default function ItemsClient({ initialItems, initialFilters }: Props) {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const t = useTranslations('Items')
  const [items, setItems] = useState<Item[]>(initialItems)
  const [filters, setFilters] = useState<Filters>({ ...INITIAL_FILTERS, ...initialFilters })
  const [view, setView] = useState<'list' | 'map'>('list')
  const [initialLoading, setInitialLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialItems.length === LIMIT)
  const [error, setError] = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  const [nearbyItems, setNearbyItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const loaderRef = useRef<HTMLDivElement>(null)
  const skipRef = useRef(initialItems.length)
  const isFetchingRef = useRef(false)
  const hasMoreRef = useRef(initialItems.length === LIMIT)
  // The server component already fetched page 1 for these exact filters —
  // skip the first run of the fetch/URL-sync effects below so hydration
  // doesn't immediately throw away and re-request identical data.
  const isFirstFetch = useRef(true)
  const isFirstUrlSync = useRef(true)

  const userHasLocation = !!(user?.latitude && user?.longitude)
  const userHasZip = !!user?.zip_code
  const { location: liveLocation, status: liveLocationStatus, retry: retryLiveLocation } = useLiveLocation()
  const hasAnyLocation = userHasLocation || !!liveLocation
  const [focusItem, setFocusItem] = useState<{ id: string; token: number } | null>(null)
  const focusTokenRef = useRef(0)

  useEffect(() => {
    categoriesService.list().then(setCategories)
  }, [])

  useEffect(() => {
    if (!hasAnyLocation) { setNearbyItems([]); return }
    let cancelled = false
    const primary = userHasLocation
      ? { lat: user!.latitude!, lng: user!.longitude! }
      : liveLocation!
    const secondary = userHasLocation ? liveLocation ?? undefined : undefined
    loadNearbyItems(primary, secondary).then((results) => {
      if (!cancelled) setNearbyItems(results)
    })
    return () => { cancelled = true }
  }, [hasAnyLocation, userHasLocation, user?.latitude, user?.longitude, liveLocation])

  const buildParams = useCallback((skip: number, limit: number) => {
    const p: Record<string, string | number> = { skip, limit }
    if (filters.search) p.search = filters.search
    if (filters.category) p.category = filters.category
    if (filters.subcategory) p.subcategory = filters.subcategory
    if (filters.availability_type) p.availability_type = filters.availability_type
    if (filters.neighborhood) p.neighborhood = filters.neighborhood
    if (filters.city) p.city = filters.city

    // Home address and live location are sent whenever known, independent
    // of whether a distance filter is set — the backend applies its own
    // sane default radius when radius_km is omitted, so results are never
    // unbounded just because the visitor didn't touch the slider.
    if (userHasLocation) {
      p.lat = user!.latitude!
      p.lng = user!.longitude!
    }
    if (liveLocation) {
      if (userHasLocation) {
        p.lat2 = liveLocation.lat
        p.lng2 = liveLocation.lng
      } else {
        p.lat = liveLocation.lat
        p.lng = liveLocation.lng
      }
    }
    if (filters.radius_km > 0) p.radius_km = filters.radius_km
    return p
  }, [filters, user, userHasLocation, liveLocation])

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMoreRef.current) return
    isFetchingRef.current = true
    setLoadingMore(true)
    try {
      const data = await itemsService.list(buildParams(skipRef.current, LIMIT) as any)
      setItems((prev) => [...prev, ...data])
      skipRef.current += data.length
      hasMoreRef.current = data.length === LIMIT
      setHasMore(data.length === LIMIT)
    } catch {
      hasMoreRef.current = false
      setHasMore(false)
      setError(true)
    } finally {
      isFetchingRef.current = false
      setLoadingMore(false)
    }
  }, [buildParams])

  // Reset and initial load when filters or view change. Map view fetches
  // once with a higher limit (the backend's own cap) instead of paginating
  // — a map wants "every pin matching the filter", not an infinite-scroll
  // page at a time.
  useEffect(() => {
    if (isFirstFetch.current) {
      isFirstFetch.current = false
      return
    }

    let cancelled = false

    const run = async () => {
      skipRef.current = 0
      hasMoreRef.current = true
      isFetchingRef.current = true
      setInitialLoading(true)
      setHasMore(true)
      try {
        const limit = view === 'map' ? MAP_LIMIT : LIMIT
        const data = await itemsService.list(buildParams(0, limit) as any)
        if (cancelled) return
        setItems(data)
        setError(false)
        skipRef.current = data.length
        const more = view === 'list' && data.length === LIMIT
        hasMoreRef.current = more
        setHasMore(more)
      } catch {
        if (cancelled) return
        setItems([])
        setHasMore(false)
        setError(true)
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
  }, [filters, view, buildParams, retryTick])

  // Keeps the URL in sync with the filters (excluding radius_km, which
  // depends on the visitor's own location and isn't meaningful to share) —
  // makes searches/category pages bookmarkable, shareable and crawlable,
  // and matches the category links already used on the homepage.
  useEffect(() => {
    if (isFirstUrlSync.current) {
      isFirstUrlSync.current = false
      return
    }
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.category) params.set('category', filters.category)
    if (filters.subcategory) params.set('subcategory', filters.subcategory)
    if (filters.availability_type) params.set('availability_type', filters.availability_type)
    if (filters.neighborhood) params.set('neighborhood', filters.neighborhood)
    if (filters.city) params.set('city', filters.city)
    const qs = params.toString()
    const timer = setTimeout(() => {
      router.replace(qs ? `/items?${qs}` : '/items', { scroll: false })
    }, filters.search ? 350 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.category, filters.subcategory, filters.availability_type, filters.neighborhood, filters.city])

  // Infinite scroll via IntersectionObserver (list view only)
  // Re-run when loadMore changes (filter change) OR when initialLoading
  // flips to false (loaderRef div enters the DOM for the first time)
  useEffect(() => {
    if (initialLoading || view !== 'list') return
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, initialLoading, view])

  // Shows whichever origin the item is actually closest to — "how far this
  // is from wherever you are" is more useful than always measuring from home.
  const getDistance = (item: Item): number | undefined => {
    if (!hasAnyLocation || !item.latitude || !item.longitude) return undefined
    const distances: number[] = []
    if (userHasLocation) distances.push(haversineKm(user!.latitude!, user!.longitude!, item.latitude, item.longitude))
    if (liveLocation) distances.push(haversineKm(liveLocation.lat, liveLocation.lng, item.latitude, item.longitude))
    return Math.min(...distances)
  }

  const effectiveRadiusKm = filters.radius_km > 0 ? filters.radius_km : (hasAnyLocation ? 50 : 0)

  const hasActiveFilters = !!(filters.search || filters.category || filters.subcategory ||
    filters.availability_type || filters.neighborhood || filters.city || filters.radius_km > 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t('title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {userHasLocation && user?.city
              ? t('subtitleWithCity', { city: user.city })
              : t('subtitle')}
          </p>
          {liveLocationStatus === 'loading' && (
            <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              <LocateFixed className="w-3.5 h-3.5 animate-pulse" /> {t('locating')}
            </p>
          )}
          {(liveLocationStatus === 'denied' || liveLocationStatus === 'unsupported') && (
            <button
              onClick={retryLiveLocation}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition-colors mt-1.5"
            >
              <LocateFixed className="w-3.5 h-3.5" /> {t('useMyLocation')}
            </button>
          )}
        </div>

        {/* Nearby feed — personalized, doesn't react to the filters below */}
        {nearbyItems.length > 0 && (
          <div className="mb-8">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" /> {t('nearYou')}
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {nearbyItems.map((item) => (
                <div key={item.id} className="w-56 flex-shrink-0">
                  <ItemCard item={item} distanceKm={getDistance(item)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6">
          <ItemFilters
            filters={filters}
            onChange={setFilters}
            userHasLocation={userHasLocation}
            userHasZip={userHasZip}
            isAuthenticated={isAuthenticated}
            categories={categories}
          />
        </div>

        {/* Results header + view toggle */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {!initialLoading && items.length > 0 && (
              <>
                <span className="text-gray-700 dark:text-gray-300 font-medium">{items.length}</span>{' '}
                {view === 'list' ? t('itemsLoaded', { count: items.length }) : t('itemsOnMap', { count: items.length })}
                {filters.radius_km > 0 && (
                  <span className="text-green-600 dark:text-green-400"> · {t('withinRadius', { km: filters.radius_km })}</span>
                )}
              </>
            )}
          </p>
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 shrink-0">
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'list' ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <List className="w-4 h-4" /> {t('listView')}
            </button>
            <button
              onClick={() => setView('map')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'map' ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <MapIcon className="w-4 h-4" /> {t('mapView')}
            </button>
          </div>
        </div>

        {/* Results */}
        {initialLoading ? (
          view === 'map' ? (
            <div className="h-[600px] flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse">
              {t('loadingItems')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: LIMIT }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )
        ) : error && items.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title={t('errorTitle')}
            description={t('errorDescription')}
            action={{ label: t('retry'), onClick: () => setRetryTick((n) => n + 1) }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t('emptyTitle')}
            description={
              filters.radius_km > 0
                ? t('emptyRadius', { km: filters.radius_km })
                : hasActiveFilters
                ? t('emptyFilters')
                : t('emptyNone')
            }
          />
        ) : view === 'map' ? (
          <ItemsMapView
            items={items}
            getDistance={getDistance}
            homeLocation={userHasLocation ? { lat: user!.latitude!, lng: user!.longitude! } : undefined}
            liveLocation={liveLocation ?? undefined}
            radiusKm={effectiveRadiusKm}
            categories={categories}
            focusItem={focusItem}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  distanceKm={getDistance(item)}
                  onLocate={() => {
                    setFocusItem({ id: item.id, token: focusTokenRef.current++ })
                    setView('map')
                  }}
                />
              ))}

              {/* Skeleton cards while loading more */}
              {loadingMore && Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={`more-${i}`} />
              ))}
            </div>

            {/* Scroll trigger */}
            <div ref={loaderRef} className="h-4 mt-4" />

            {error && items.length > 0 && (
              <div className="flex flex-col items-center gap-2 mt-6 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> {t('loadMoreError')}
                </span>
                <button
                  onClick={() => { setError(false); hasMoreRef.current = true; setHasMore(true); loadMore() }}
                  className="flex items-center gap-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                >
                  <RotateCw className="w-3.5 h-3.5" /> {t('retry')}
                </button>
              </div>
            )}

            {!error && !hasMore && items.length > LIMIT && (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-6">
                {t('allLoaded')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
