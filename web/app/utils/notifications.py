from app.models.user import User

_TOGGLEABLE_CATEGORIES = (
    "request_status",
    "new_message",
    "verification_result",
    "item_available",
    "review_reminder",
)


def should_notify(user: User, category: str) -> bool:
    """Whether `user` wants the given convenience-email category. Security
    emails (verification link, password reset, new-login alert) never go
    through this — they aren't toggleable."""
    assert category in _TOGGLEABLE_CATEGORIES, f"unknown category {category!r}"
    prefs = user.notification_prefs
    return bool(getattr(prefs, category, True))
