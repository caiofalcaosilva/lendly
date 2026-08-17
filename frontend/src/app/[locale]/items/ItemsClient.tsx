'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from '@/i18n/navigation'
import { Package, List, Map as MapIcon, MapPin, LocateFixed, AlertTriangle, RotateCw, Megaphone, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Category, Item, ItemsBanner } from '@/types'
import { itemsService } from '@/services/items'
import { categoriesService } from '@/services/categories'
import { platformSettingsService } from '@/services/platformSettings'
import { useAuth } from '@/contexts/AuthContext'
import { haversineKm } from '@/lib/utils'
import ItemCard from '@/components/items/ItemCard'
import ItemFilters, { Filters } from '@/components/items/ItemFilters'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import Select from '@/components/ui/Select'
import AdSlot from '@/components/ui/AdSlot'

function MapLoading() {
  const t = useTranslations('Items')
  return (
    <div className="h-[600px] flex items-center justify-center text-ink-subtle bg-surface-2 rounded-panel">
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
    <div className="bg-surface rounded-panel border border-border overflow-hidden">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-3.5 space-y-2.5">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="pt-2 border-t border-border flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
    </div>
  )
}

type Sort = '' | 'nearest' | 'price_asc'

interface Props {
  initialItems: Item[]
  initialFilters: Partial<Filters>
  initialSort?: Sort
}

export default function ItemsClient({ initialItems, initialFilters, initialSort = '' }: Props) {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const t = useTranslations('Items')
  const [sort, setSort] = useState<Sort>(initialSort)
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
  const [itemsBanner, setItemsBanner] = useState<ItemsBanner | null>(null)
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
    platformSettingsService.itemsBanner().then((b) => {
      if (b.active && b.message) setItemsBanner(b)
    })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `user` intentionally narrowed to lat/lng: refetch only when location actually changes, not on unrelated user updates
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
    if (sort) p.sort = sort
    return p
  }, [filters, sort, user, userHasLocation, liveLocation])

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
    if (sort) params.set('sort', sort)
    const qs = params.toString()
    const timer = setTimeout(() => {
      router.replace(qs ? `/items?${qs}` : '/items', { scroll: false })
    }, filters.search ? 350 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.category, filters.subcategory, filters.availability_type, filters.neighborhood, filters.city, sort])

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
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-1">{t('title')}</h1>
          <p className="text-ink-muted text-sm">
            {userHasLocation && user?.city
              ? t('subtitleWithCity', { city: user.city })
              : t('subtitle')}
          </p>
          {liveLocationStatus === 'loading' && (
            <p className="flex items-center gap-1.5 text-xs text-ink-subtle mt-1.5">
              <LocateFixed className="w-3.5 h-3.5 animate-pulse" /> {t('locating')}
            </p>
          )}
          {(liveLocationStatus === 'denied' || liveLocationStatus === 'unsupported') && (
            <button
              onClick={retryLiveLocation}
              className="flex items-center gap-1.5 text-xs text-ink-subtle hover:text-primary transition-colors mt-1.5"
            >
              <LocateFixed className="w-3.5 h-3.5" /> {t('useMyLocation')}
            </button>
          )}
        </div>

        {/* Nearby feed — personalized, doesn't react to the filters below */}
        {nearbyItems.length > 0 && (
          <div className="mb-8">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted mb-3">
              <MapPin className="w-4 h-4 text-primary" /> {t('nearYou')}
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

        {itemsBanner && (
          <div className="flex items-center gap-3 mb-6 p-4 rounded-panel bg-info-subtle border border-info/30">
            <Megaphone className="w-4 h-4 text-info flex-shrink-0" />
            <p className="text-sm text-ink flex-1">{itemsBanner.message}</p>
            {itemsBanner.link_url && (
              <a
                href={itemsBanner.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm font-medium text-info hover:underline flex-shrink-0"
              >
                {itemsBanner.link_label || t('bannerLinkDefault')} <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        <AdSlot />

        {/* Results header + view toggle */}
        <h2 className="sr-only">{t('resultsHeading')}</h2>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-ink-subtle">
            {!initialLoading && items.length > 0 && (
              <>
                <span className="text-ink-muted font-medium">{items.length}</span>{' '}
                {view === 'list' ? t('itemsLoaded', { count: items.length }) : t('itemsOnMap', { count: items.length })}
                {filters.radius_km > 0 && (
                  <span className="text-primary"> · {t('withinRadius', { km: filters.radius_km })}</span>
                )}
              </>
            )}
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <label htmlFor="items-sort" className="text-xs text-ink-subtle whitespace-nowrap">
                {t('sortLabel')}
              </label>
              <Select
                id="items-sort"
                className="w-auto py-1.5 text-xs"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                <option value="">{t('sortNewest')}</option>
                <option value="price_asc">{t('sortPriceAsc')}</option>
                {hasAnyLocation && <option value="nearest">{t('sortNearest')}</option>}
              </Select>
            </div>
            <div className="inline-flex rounded-control border border-border bg-surface p-0.5 shrink-0">
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'list' ? 'bg-primary text-primary-on' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <List className="w-4 h-4" /> {t('listView')}
            </button>
            <button
              onClick={() => setView('map')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'map' ? 'bg-primary text-primary-on' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <MapIcon className="w-4 h-4" /> {t('mapView')}
            </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {initialLoading ? (
          view === 'map' ? (
            <div className="h-[600px] flex items-center justify-center text-ink-subtle bg-surface-2 rounded-panel animate-pulse">
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
              <div className="flex flex-col items-center gap-2 mt-6 text-sm text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-warning" /> {t('loadMoreError')}
                </span>
                <button
                  onClick={() => { setError(false); hasMoreRef.current = true; setHasMore(true); loadMore() }}
                  className="flex items-center gap-1.5 text-primary hover:text-primary-hover font-medium"
                >
                  <RotateCw className="w-3.5 h-3.5" /> {t('retry')}
                </button>
              </div>
            )}

            {!error && !hasMore && items.length > LIMIT && (
              <p className="text-center text-sm text-ink-subtle mt-6">
                {t('allLoaded')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
