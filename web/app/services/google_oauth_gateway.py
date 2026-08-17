"""Google Sign-In — plain HTTPS calls via httpx rather than a Google SDK
(there's no equivalent lightweight one installed, and the standard
authorization-code flow is simple enough not to need one). Identity comes
from calling the userinfo endpoint with the access token we just got back
from a trusted server-to-server code exchange, rather than verifying the
id_token's JWT signature ourselves — equally safe here since that access
token could only have come from a real code Google issued, and it's
simpler than fetching/caching Google's public keys."""

import logging
from urllib.parse import urlencode

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


class GoogleOAuthError(Exception):
    pass


def get_authorization_url(state: str) -> str:
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def exchange_code(code: str) -> str:
    """Returns the Google access_token for the just-authorized user."""
    response = httpx.post(
        TOKEN_URL,
        data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    if response.status_code != 200:
        logger.error(
            "google oauth code exchange rejected",
            extra={"status": response.status_code, "body": response.text},
        )
        raise GoogleOAuthError("Google rejeitou o código de autorização")
    return response.json()["access_token"]


def get_userinfo(access_token: str) -> dict:
    """Returns {sub, email, name, picture} for the authenticated Google
    account."""
    response = httpx.get(
        USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if response.status_code != 200:
        logger.error(
            "google userinfo request rejected",
            extra={"status": response.status_code, "body": response.text},
        )
        raise GoogleOAuthError("Não foi possível obter os dados da conta Google")
    return response.json()
