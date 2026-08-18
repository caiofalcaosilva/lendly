from app.config import settings


def frontend_origin() -> str:
    """FRONTEND_URL can hold multiple comma-separated origins (local dev,
    for testing over the LAN from a phone) — CORS in main.py already
    splits on that; anything that builds a single URL (OAuth redirect_uri,
    email links) needs exactly one origin, so this takes the first."""
    return settings.FRONTEND_URL.split(",")[0].strip()
