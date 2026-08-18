import math

EARTH_RADIUS_KM = 6371.0


def to_point(lat: float | None, lng: float | None) -> list[float] | None:
    """GeoJSON coordinate order is [lng, lat] — the opposite of the
    `latitude, longitude` convention used everywhere else in this codebase.
    Isolating that inversion here, in one place, is what keeps it from
    getting silently swapped somewhere a Point is built by hand."""
    if lat is None or lng is None:
        return None
    return [lng, lat]


def radius_km_to_radians(radius_km: float) -> float:
    """$centerSphere/geo_within_sphere expect the radius in radians, not km."""
    return radius_km / EARTH_RADIUS_KM


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
