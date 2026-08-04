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

    # Fernet key (32 url-safe base64 bytes) used to encrypt mp_access_token/
    # mp_refresh_token at rest — unlike password hashing these must be
    # recoverable to call the Mercado Pago API on the seller's behalf, so a
    # hash won't do. Generate with `Fernet.generate_key()`. Placeholder here
    # is dev-only, same spirit as SECRET_KEY above.
    ENCRYPTION_KEY: str = "changeme-32-byte-fernet-key-base64=="

    # Mercado Pago — payment gateway (see docs/pagamento-online design doc).
    # All blank by default; payment features stay inert until an admin fills
    # these in a real .env, same lazy-configuration spirit as SMTP above.
    MP_APP_ID: str = ""
    MP_CLIENT_SECRET: str = ""
    MP_ACCESS_TOKEN: str = ""
    MP_WEBHOOK_SECRET: str = ""
    # Lendly's cut of every paid loan, taken from the seller's payout —
    # the buyer always pays exactly daily_rate × days, never more.
    PLATFORM_FEE_PERCENT: float = 0.05

    model_config = {"env_file": ".env"}


settings = Settings()
