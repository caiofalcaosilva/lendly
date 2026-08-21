"""Cloudflare Turnstile bot check — plain HTTPS call via httpx, same
pattern as google_oauth_gateway.py. Inert (verify() always passes) until
TURNSTILE_SECRET_KEY is configured, same "blank until configured" pattern
as every other external integration in this codebase."""

import httpx

from app.config import settings

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify(token: str) -> bool:
    if not settings.TURNSTILE_SECRET_KEY:
        return True

    if not token:
        return False

    response = httpx.post(
        SITEVERIFY_URL,
        data={"secret": settings.TURNSTILE_SECRET_KEY, "response": token},
        timeout=10,
    )
    if response.status_code != 200:
        return False
    return bool(response.json().get("success"))
