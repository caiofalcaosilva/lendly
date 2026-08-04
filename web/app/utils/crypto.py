from cryptography.fernet import Fernet

from app.config import settings


def _fernet() -> Fernet:
    # Lazy — so an app without ENCRYPTION_KEY configured yet still boots
    # fine; it only fails the moment something actually needs encrypting
    # (i.e. a seller connecting Mercado Pago), same lazy-config spirit as
    # the rest of settings.py.
    return Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
