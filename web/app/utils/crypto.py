from cryptography.fernet import Fernet

from app.config import settings


def _fernet() -> Fernet:
    return Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
