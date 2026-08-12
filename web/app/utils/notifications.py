from app.models.user import User

_EMAIL_CATEGORIES = (
    "request_status",
    "new_message",
    "verification_result",
    "item_available",
    "review_reminder",
)

# Bell-only categories — events with no email equivalent at all (a group
# vouch or a favorited item's price change isn't worth an email, but is
# worth a bell). Never valid for should_notify(), only should_notify_inapp().
_INAPP_ONLY_CATEGORIES = (
    "group_vouch",
    "favorite_item_changed",
    "group_new_item",
)

_INAPP_CATEGORIES = _EMAIL_CATEGORIES + _INAPP_ONLY_CATEGORIES

# Never gated by a preference, in-app or email — a new-login alert is a
# security signal, not a convenience notification the user gets to mute.
_SECURITY_CATEGORIES = ("new_login",)


def is_security_category(category: str) -> bool:
    return category in _SECURITY_CATEGORIES


def should_notify(user: User, category: str) -> bool:
    """Whether `user` wants the given convenience-email category. Security
    emails (verification link, password reset, new-login alert) never go
    through this — they aren't toggleable."""
    assert category in _EMAIL_CATEGORIES, f"unknown category {category!r}"
    prefs = user.notification_prefs
    return bool(getattr(prefs, category, True))


def should_notify_inapp(user: User, category: str) -> bool:
    """Same gate as should_notify, but for the in-app bell — a separate
    preference set (User.inapp_notification_prefs), so turning off email
    for a category doesn't also mute the bell, and vice versa. Also
    accepts the 2 bell-only categories that have no email counterpart."""
    assert category in _INAPP_CATEGORIES, f"unknown category {category!r}"
    prefs = user.inapp_notification_prefs
    return bool(getattr(prefs, category, True))
