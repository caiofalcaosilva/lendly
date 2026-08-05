from datetime import UTC, datetime


def utcnow() -> datetime:
    """Naive UTC datetime — every DateTimeField and comparison in this
    codebase (MongoEngine/pymongo) works with naive-UTC values, so this
    keeps that contract while avoiding the deprecated `datetime.utcnow()`."""
    return datetime.now(UTC).replace(tzinfo=None)
