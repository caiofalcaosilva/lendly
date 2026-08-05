from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    IntField,
    ReferenceField,
    StringField,
)

from app.utils.time import utcnow


class PlatformSettings(Document):
    """Singleton — always exactly one row. See
    platform_settings_service.get_settings() for the lazy-seed pattern."""

    access_token_expire_minutes = IntField(default=30, min_value=1)
    refresh_token_expire_days = IntField(default=30, min_value=1)
    email_verification_expire_hours = IntField(default=24, min_value=1)
    login_rate_limit_per_minute = IntField(default=5, min_value=1)
    register_rate_limit_per_minute = IntField(default=5, min_value=1)
    complete_2fa_rate_limit_per_minute = IntField(default=5, min_value=1)
    refresh_rate_limit_per_minute = IntField(default=10, min_value=1)
    resend_verification_rate_limit_per_minute = IntField(default=3, min_value=1)
    chat_message_rate_limit_per_minute = IntField(default=20, min_value=1)
    announcement_message = StringField(max_length=280)
    announcement_active = BooleanField(default=False)
    updated_by = ReferenceField("User")
    updated_at = DateTimeField(default=utcnow)

    meta = {"collection": "platform_settings"}
