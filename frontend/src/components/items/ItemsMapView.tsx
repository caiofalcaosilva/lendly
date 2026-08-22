'use client'
import { useEffect, useMemo, useRef } from 'react'
import { Link } from '@/i18n/navigation'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useLocale, useTranslations } from 'next-intl'
import { Category, Item } from '@/types'
import { formatCurrency, getCategoryLabel, formatDistance } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

// CARTO's basemaps — same free OSM data, restyled to the clean, muted look
// most map-based apps use today instead of the busy/saturated default OSM
// tiles. Dark Matter automatically matches the app's dark mode.
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}

// Hex equivalents of the Tailwind category colors used in ItemCard.tsx —
// Leaflet's divIcon needs inline CSS, can't reuse Tailwind classes directly.
const CATEGORY_MARKER_COLORS: Record<string, string> = {
  tools: '#ea580c',
  electronics: '#2563eb',
  sports: '#059669',
  garden: '#16a34a',
  kitchen: '#e11d48',
  books: '#4f46e5',
  toys: '#9333ea',
  clothing: '#db2777',
  furniture: '#d97706',
  other: '#4b5563',
}

function categoryIcon(category: string) {
  const color = CATEGORY_MARKER_COLORS[category] ?? CATEGORY_MARKER_COLORS.other
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:16px;height:16px;border-radius:9999px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  })
}

// Distinctly bigger + shaped like a map pin (not a flat dot) so it never
// reads as just another item marker, whatever the zoom level. The rounded-
// square-rotated-45° trick is what most modern map UIs (Apple Maps, most
// web map kits) use for a soft "balloon" pin instead of the sharper classic
// teardrop. Gradient fill + house glyph inside the white disc — same
// "icon inside the pin" polish as LocationMapPicker's editable green pin
// (this one's the fixed/registered-address counterpart, blue instead).
const HOME_COLOR = '#1d4ed8'
const HOME_COLOR_DARK = '#1e40af'
function homeIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:30px;height:30px">
        <div style="position:absolute;inset:0;background:linear-gradient(135deg, ${HOME_COLOR} 0%, ${HOME_COLOR_DARK} 100%);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,0.3)"></div>
        <div style="position:absolute;top:8px;left:8px;width:14px;height:14px;background:white;border-radius:9999px;display:flex;align-items:center;justify-content:center">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="${HOME_COLOR_DARK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
      </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  })
}

// "You are here" — the pulsing-dot pattern used by virtually every map app,
// in a color that doesn't collide with any category marker.
const LIVE_COLOR = '#0ea5e9'
function liveLocationIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:26px;height:26px">
        <div style="position:absolute;inset:0;border-radius:9999px;background:${LIVE_COLOR};opacity:0.35;animation:map-pulse 2s ease-out infinite"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:9999px;background:${LIVE_COLOR};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>
      </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  })
}

// Matches the app's own brand green (bg-green-600 elsewhere) instead of the
// cluster plugin's default yellow/orange, so it doesn't clash with the
// CARTO tiles or the rest of the UI.
const CLUSTER_COLOR = '#16a34a'
function createClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount()
  const size = count < 10 ? 34 : count < 50 ? 42 : 50
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${CLUSTER_COLOR};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:${count < 100 ? 13 : 11}px">${count}</div>`,
    iconSize: L.point(size, size, true),
  })
}

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333] // São Paulo fallback

interface Props {
  items: Item[]
  getDistance: (item: Item) => number | undefined
  /** Registered/home address. */
  homeLocation?: { lat: number; lng: number }
  /** Live browser geolocation, when granted. */
  liveLocation?: { lat: number; lng: number }
  radiusKm?: number
  categories: Category[]
  /** A specific item to pan/zoom to and pop open — set from a "ver no
   * mapa" click on a list card. `token` just needs to change on every
   * click so re-focusing the same item twice in a row still fires. */
  focusItem?: { id: string; token: number } | null
}

/** Fits the map to the visible pins (+ user location) whenever they change. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 13)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
  }, [points, map])
  return null
}

/** Pans/zooms to a specific item's marker and opens its popup — including
 * zooming out of a cluster first if the marker is currently grouped. */
function FocusItem({
  focusItem,
  itemsWithCoords,
  markersRef,
  clusterRef,
}: {
  focusItem?: { id: string; token: number } | null
  itemsWithCoords: Item[]
  markersRef: React.MutableRefObject<Map<string, L.Marker>>
  clusterRef: React.MutableRefObject<{ zoomToShowLayer?: (layer: L.Layer, cb: () => void) => void } | null>
}) {
  const map = useMap()
  useEffect(() => {
    if (!focusItem) return
    const item = itemsWithCoords.find((i) => i.id === focusItem.id)
    const marker = markersRef.current.get(focusItem.id)
    if (!item || !marker || item.latitude == null || item.longitude == null) return
    // On a fresh mount (list -> map click), the cluster group's ref can
    // already point at the plugin instance before Leaflet has actually
    // attached it to the map (its own effect hasn't run yet) — calling
    // zoomToShowLayer that early reads `this._map._zoom` on an undefined
    // `_map` and throws. Only take that path once it's really attached;
    // map.flyTo below is always safe since the map itself sets its zoom
    // synchronously at construction.
    const cluster = clusterRef.current
    const clusterReady = cluster?.zoomToShowLayer && (cluster as unknown as { _map?: unknown })._map
    if (clusterReady) {
      cluster!.zoomToShowLayer!(marker, () => marker.openPopup())
    } else {
      map.flyTo([item.latitude, item.longitude], 16)
      marker.openPopup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusItem?.id, focusItem?.token])
  return null
}

export default function ItemsMapView({ items, getDistance, homeLocation, liveLocation, radiusKm, categories, focusItem }: Props) {
  const { theme } = useTheme()
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.ItemsMapView')
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const clusterRef = useRef<{ zoomToShowLayer?: (layer: L.Layer, cb: () => void) => void } | null>(null)

  const itemsWithCoords = useMemo(
    () => items.filter((i) => i.latitude != null && i.longitude != null),
    [items],
  )
  const itemsWithoutCoords = items.length - itemsWithCoords.length

  const boundsPoints = useMemo<[number, number][]>(() => {
    const points = itemsWithCoords.map((i) => [i.latitude!, i.longitude!] as [number, number])
    if (homeLocation) points.push([homeLocation.lat, homeLocation.lng])
    if (liveLocation) points.push([liveLocation.lat, liveLocation.lng])
    return points
  }, [itemsWithCoords, homeLocation, liveLocation])

  const initialCenter: [number, number] = liveLocation
    ? [liveLocation.lat, liveLocation.lng]
    : homeLocation
    ? [homeLocation.lat, homeLocation.lng]
    : boundsPoints[0] ?? DEFAULT_CENTER

  return (
    <div>
      {/* isolate: Leaflet's own panes/controls use z-index up to 1000 (meant
          for full-page maps) — without a new stacking context here, they'd
          render above this page's sticky header (z-40) once scrolled. */}
      <div className="h-[600px] w-full rounded-panel overflow-hidden border border-border isolate">
        <MapContainer center={initialCenter} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution={CARTO_ATTRIBUTION}
            url={theme === 'dark' ? TILE_URLS.dark : TILE_URLS.light}
          />
          <FitBounds points={boundsPoints} />

          {homeLocation && (
            <>
              <Marker position={[homeLocation.lat, homeLocation.lng]} icon={homeIcon()} zIndexOffset={1000}>
                <Popup>{t('homeMarker')}</Popup>
              </Marker>
              {!!radiusKm && radiusKm > 0 && (
                <Circle
                  center={[homeLocation.lat, homeLocation.lng]}
                  radius={radiusKm * 1000}
                  pathOptions={{ color: HOME_COLOR, fillColor: HOME_COLOR, fillOpacity: 0.06, weight: 1.5 }}
                />
              )}
            </>
          )}

          {liveLocation && (
            <>
              <Marker position={[liveLocation.lat, liveLocation.lng]} icon={liveLocationIcon()} zIndexOffset={1000}>
                <Popup>{t('liveMarker')}</Popup>
              </Marker>
              {!!radiusKm && radiusKm > 0 && (
                <Circle
                  center={[liveLocation.lat, liveLocation.lng]}
                  radius={radiusKm * 1000}
                  pathOptions={{ color: LIVE_COLOR, fillColor: LIVE_COLOR, fillOpacity: 0.06, weight: 1.5, dashArray: '6 4' }}
                />
              )}
            </>
          )}

          <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterIcon} ref={clusterRef as any}>
            {itemsWithCoords.map((item) => {
              const distanceKm = getDistance(item)
              return (
                <Marker
                  key={item.id}
                  position={[item.latitude!, item.longitude!]}
                  icon={categoryIcon(item.category)}
                  ref={(m) => {
                    if (m) markersRef.current.set(item.id, m)
                    else markersRef.current.delete(item.id)
                  }}
                >
                  <Popup minWidth={200}>
                    <Link href={`/items/${item.id}`} className="block -m-1">
                      {item.photos?.[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photos[0]}
                          alt={item.title}
                          className="w-full h-24 object-cover rounded-md mb-2"
                        />
                      )}
                      <span
                        className="inline-block text-[10px] font-semibold uppercase tracking-wide mb-1"
                        style={{ color: CATEGORY_MARKER_COLORS[item.category] ?? CATEGORY_MARKER_COLORS.other }}
                      >
                        {getCategoryLabel(categories, item.category)}
                      </span>
                      <p className="font-semibold text-sm text-gray-900 leading-snug mb-1">{item.title}</p>
                      <p className="text-xs text-gray-600 mb-1">
                        {item.availability_type === 'free' ? (
                          <span className="text-green-600 font-medium">{t('free')}</span>
                        ) : (
                          <><span className="font-mono tabular-nums">{formatCurrency(item.daily_rate ?? 0, locale)}</span><span className="text-gray-400">{t('perDay')}</span></>
                        )}
                        {distanceKm != null && <span className="text-gray-400 font-mono tabular-nums"> · {formatDistance(distanceKm)}</span>}
                      </p>
                      <span className="text-xs font-medium text-green-700">{t('viewDetails')}</span>
                    </Link>
                  </Popup>
                </Marker>
              )
            })}
          </MarkerClusterGroup>

          {/* Rendered after MarkerClusterGroup on purpose — its effect
              needs the cluster layer already attached to the map (see
              FocusItem's own comment on the _map guard below). */}
          <FocusItem
            focusItem={focusItem}
            itemsWithCoords={itemsWithCoords}
            markersRef={markersRef}
            clusterRef={clusterRef}
          />
        </MapContainer>
      </div>

      {itemsWithoutCoords > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          {t('withoutLocation', { count: itemsWithoutCoords })}
        </p>
      )}
    </div>
  )
}
