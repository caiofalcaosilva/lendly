'use client'
import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Category, Item } from '@/types'
import { formatCurrency, getCategoryLabel, formatDistance } from '@/lib/utils'

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

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333] // São Paulo fallback

interface Props {
  items: Item[]
  getDistance: (item: Item) => number | undefined
  userLocation?: { lat: number; lng: number }
  radiusKm?: number
  categories: Category[]
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

export default function ItemsMapView({ items, getDistance, userLocation, radiusKm, categories }: Props) {
  const itemsWithCoords = useMemo(
    () => items.filter((i) => i.latitude != null && i.longitude != null),
    [items],
  )
  const itemsWithoutCoords = items.length - itemsWithCoords.length

  const boundsPoints = useMemo<[number, number][]>(() => {
    const points = itemsWithCoords.map((i) => [i.latitude!, i.longitude!] as [number, number])
    if (userLocation) points.push([userLocation.lat, userLocation.lng])
    return points
  }, [itemsWithCoords, userLocation])

  const initialCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : boundsPoints[0] ?? DEFAULT_CENTER

  return (
    <div>
      <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
        <MapContainer center={initialCenter} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={boundsPoints} />

          {userLocation && (
            <>
              <CircleMarker
                center={[userLocation.lat, userLocation.lng]}
                radius={8}
                pathOptions={{ color: 'white', weight: 2, fillColor: '#1d4ed8', fillOpacity: 1 }}
              />
              {!!radiusKm && radiusKm > 0 && (
                <Circle
                  center={[userLocation.lat, userLocation.lng]}
                  radius={radiusKm * 1000}
                  pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.08, weight: 1.5 }}
                />
              )}
            </>
          )}

          <MarkerClusterGroup chunkedLoading>
            {itemsWithCoords.map((item) => {
              const distanceKm = getDistance(item)
              return (
                <Marker
                  key={item.id}
                  position={[item.latitude!, item.longitude!]}
                  icon={categoryIcon(item.category)}
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
                          <span className="text-green-600 font-medium">Gratuito</span>
                        ) : (
                          <>{formatCurrency(item.daily_rate ?? 0)}<span className="text-gray-400">/dia</span></>
                        )}
                        {distanceKm != null && <span className="text-gray-400"> · {formatDistance(distanceKm)}</span>}
                      </p>
                      <span className="text-xs font-medium text-green-700">Ver detalhes →</span>
                    </Link>
                  </Popup>
                </Marker>
              )
            })}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {itemsWithoutCoords > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          {itemsWithoutCoords} item{itemsWithoutCoords !== 1 ? 's' : ''} sem localização não aparece
          {itemsWithoutCoords !== 1 ? 'm' : ''} no mapa.
        </p>
      )}
    </div>
  )
}
