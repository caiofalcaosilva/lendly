export interface Coordinates {
  latitude: number
  longitude: number
}

// BrasilAPI's CEP v2 endpoint sometimes has no coordinates for a given CEP
// (returns `location.coordinates: {}`) — when that happens, fall back to a
// free-text geocode of neighborhood/city/state via Nominatim (OpenStreetMap,
// no API key needed). Better an approximate neighborhood-level coordinate
// than none at all, and definitely better than silently reusing someone
// else's coordinates as a stand-in.
export async function resolveCoordinates(
  cepDigits: string,
  neighborhood?: string,
  city?: string,
  state?: string,
): Promise<Coordinates | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepDigits}`)
    if (res.ok) {
      const geo = await res.json()
      const coords = geo?.location?.coordinates
      if (coords?.latitude && coords?.longitude) {
        return { latitude: parseFloat(coords.latitude), longitude: parseFloat(coords.longitude) }
      }
    }
  } catch {
    // fall through to the Nominatim fallback below
  }

  if (!neighborhood || !city || !state) return null
  try {
    const query = encodeURIComponent(`${neighborhood}, ${city} - ${state}, Brasil`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${query}`,
    )
    if (!res.ok) return null
    const results = await res.json()
    const hit = results?.[0]
    if (hit?.lat && hit?.lon) {
      return { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon) }
    }
  } catch {
    // no coordinates available from either source
  }
  return null
}
