import pyotp

from app.config import settings


def generate_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name=settings.TOTP_ISSUER,
    )


def verify_code(secret: str, code: str) -> bool:
    # valid_window=1 accepts one period before/after (30 s tolerance)
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)
