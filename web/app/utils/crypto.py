import hashlib

from cryptography.fernet import Fernet

from app.config import settings


def _fernet() -> Fernet:
    return Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def digits_hash(digits: str) -> str:
    """Deterministic blind index for an encrypted field (CPF/CNPJ) that
    still needs exact-match lookup/uniqueness — Fernet ciphertext isn't
    deterministic, so the encrypted value itself can't be queried or
    constrained unique. Not a secret-keeping hash (CPF/CNPJ digit spaces
    are small enough to enumerate regardless); it only exists so the
    plaintext never has to be stored to look a record up by it."""
    return hashlib.sha256(digits.encode()).hexdigest()
