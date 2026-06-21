from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "lendly"
    SECRET_KEY: str = "changeme-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

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

    model_config = {"env_file": ".env"}


settings = Settings()
