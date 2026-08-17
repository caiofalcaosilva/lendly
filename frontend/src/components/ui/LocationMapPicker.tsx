'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/contexts/ThemeContext'

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}

// Same balloon-pin shape as the "home" marker on the browse map, but in the
// brand green (draggable/editable) instead of that marker's blue (fixed) —
// the color difference itself signals "you can move this one". A subtle
// gradient (rather than flat fill), a softer/larger shadow, and a small
// house glyph inside the white disc — same "icon inside the pin" polish
// most consumer map UIs (Uber, iFood, Airbnb) use instead of a blank dot.
const PIN_COLOR = '#16a34a'
const PIN_COLOR_DARK = '#15803d'
function pinIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:34px">
        <div style="position:absolute;inset:0;background:linear-gradient(135deg, ${PIN_COLOR} 0%, ${PIN_COLOR_DARK} 100%);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,0.3)"></div>
        <div style="position:absolute;top:9px;left:9px;width:16px;height:16px;background:white;border-radius:9999px;display:flex;align-items:center;justify-content:center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${PIN_COLOR_DARK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  })
}

interface Props {
  latitude: number
  longitude: number
  onChange: (lat: number, lng: number) => void
}

// Recenters the map when the position changes for a reason other than
// dragging/clicking the pin itself (e.g. a new CEP was just looked up) —
// a move made from inside the map already shows the pin where the user put
// it, so re-panning under them right after would just be disorienting.
function Recenter({
  position,
  skipNextRef,
}: {
  position: [number, number]
  skipNextRef: React.MutableRefObject<boolean>
}) {
  const map = useMap()
  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false
      return
    }
    map.setView(position, Math.max(map.getZoom(), 15))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1]])
  return null
}

function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function LocationMapPicker({ latitude, longitude, onChange }: Props) {
  const { theme } = useTheme()
  const t = useTranslations('Common.LocationMapPicker')
  const skipNextRecenter = useRef(false)
  const position: [number, number] = [latitude, longitude]

  const handleInternalMove = (lat: number, lng: number) => {
    skipNextRecenter.current = true
    onChange(lat, lng)
  }

  return (
    <div>
      {/* isolate: Leaflet's own panes/controls use z-index up to 1000 (meant
          for full-page maps) — without a new stacking context here, they'd
          render above this page's sticky header (z-40) once scrolled. */}
      <div className="h-[280px] w-full rounded-panel overflow-hidden border border-border isolate">
        <MapContainer center={position} zoom={16} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution={CARTO_ATTRIBUTION} url={theme === 'dark' ? TILE_URLS.dark : TILE_URLS.light} />
          <Recenter position={position} skipNextRef={skipNextRecenter} />
          <ClickToMove onMove={handleInternalMove} />
          <Marker
            position={position}
            icon={pinIcon()}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng()
                handleInternalMove(lat, lng)
              },
            }}
          />
        </MapContainer>
      </div>
      <p className="text-xs text-ink-subtle mt-2">{t('hint')}</p>
    </div>
  )
}
