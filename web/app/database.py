import mongoengine
from app.config import settings


def connect_db() -> None:
    mongoengine.connect(db=settings.MONGODB_DB, host=settings.MONGODB_URL)


def disconnect_db() -> None:
    mongoengine.disconnect()
