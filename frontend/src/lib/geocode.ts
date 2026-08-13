export interface Coordinates {
  latitude: number
  longitude: number
}

// BrasilAPI's CEP v2 endpoint (via its "open-cep" source) returns the same
// fixed city-centroid coordinate for every CEP in a city, regardless of
// neighborhood — not a per-address coordinate. That made every user/item in
// the same city end up with identical lat/lng. Nominatim (OpenStreetMap, no
// API key needed) actually differentiates by neighborhood, so it's the
// primary source; BrasilAPI's coordinates are only used as a last resort if
// Nominatim has nothing (e.g. neighborhood/city/state missing).
export async function resolveCoordinates(
  cepDigits: string,
  neighborhood?: string,
  city?: string,
  state?: string,
): Promise<Coordinates | null> {
  if (neighborhood && city && state) {
    try {
      const query = encodeURIComponent(`${neighborhood}, ${city} - ${state}, Brasil`)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${query}`,
      )
      if (res.ok) {
        const results = await res.json()
        const hit = results?.[0]
        if (hit?.lat && hit?.lon) {
          return { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon) }
        }
      }
    } catch {
      // fall through to the BrasilAPI fallback below
    }
  }

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
    // no coordinates available from either source
  }
  return null
}
