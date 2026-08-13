from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "lendly"
    SECRET_KEY: str = "changeme-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Email
    SMTP_HOST: str = "mailhog"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = "noreply@lendly.app"
    SMTP_TLS: bool = False
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24

    # App
    FRONTEND_URL: str = "http://localhost:3000"
    TOTP_ISSUER: str = "Lendly"
    # Base URL used to build absolute photo URLs returned by the upload
    # endpoint. Override to http://10.0.2.2:8000 for the Android emulator.
    API_PUBLIC_URL: str = "http://localhost:8000"

    # Fernet key (32 url-safe base64 bytes) — generate with Fernet.generate_key().
    ENCRYPTION_KEY: str = "changeme-32-byte-fernet-key-base64=="

    # Mercado Pago (see docs/pagamento-online.md) — blank by default, payment
    # features stay inert until an admin fills these in a real .env.
    MP_APP_ID: str = ""
    MP_CLIENT_SECRET: str = ""
    MP_ACCESS_TOKEN: str = ""
    MP_WEBHOOK_SECRET: str = ""
    # Lendly's cut of every paid loan, taken from the seller's payout.
    PLATFORM_FEE_PERCENT: float = 0.05

    # Kill switch for the paid-rental side of the marketplace — set to true
    # to run a free-lending-only pilot before the business has a CNPJ (Mercado
    # Pago's marketplace split needs one). Blocks creating/editing items as
    # paid at the API, regardless of what the frontend shows.
    FREE_LENDING_ONLY: bool = False

    # Cloudflare R2 (S3-compatible object storage) for uploaded photos and
    # verification documents — see app/services/storage.py. Blank by
    # default, same "inert until filled in" pattern as Mercado Pago above:
    # uploads stay on local disk (uploads/, verification_uploads/), which is
    # fine for local dev but doesn't survive a redeploy on most hosts, so
    # fill these in before deploying anywhere with an ephemeral filesystem.
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    # Public base URL for the bucket (its r2.dev URL, or a custom domain
    # mapped to it) — used to build URLs for publicly-served uploads
    # (avatars/items/groups). Not needed for verification documents, which
    # are private and served via a presigned URL instead.
    R2_PUBLIC_URL: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()

_INSECURE_DEFAULTS = {
    "SECRET_KEY": "changeme-in-production",
    "ENCRYPTION_KEY": "changeme-32-byte-fernet-key-base64==",
}


def assert_secrets_configured() -> None:
    """Called from main.py's startup — fails loudly if a placeholder secret
    is still in place, rather than silently signing JWTs (or encrypting
    Mercado Pago tokens) with a value anyone can read straight out of this
    file."""
    for field, placeholder in _INSECURE_DEFAULTS.items():
        if getattr(settings, field) == placeholder:
            raise RuntimeError(
                f"{field} is still set to its placeholder value — set a real "
                "one in .env before starting the app."
            )
