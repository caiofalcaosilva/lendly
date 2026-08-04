from datetime import datetime

from mongoengine import BooleanField, DateTimeField, Document, IntField, ReferenceField, StringField


class PlatformSettings(Document):
    """Singleton document (always exactly one row) holding operational
    knobs an admin can tune without touching .env/redeploying. Only a
    deliberately narrow set of non-sensitive values live here — secrets
    (SECRET_KEY, SMTP creds, DB URL) stay .env-only. See
    platform_settings_service.get_settings() for the lazy-seed-on-first-use
    pattern (defaults mirror config.py's current .env-derived values)."""

    access_token_expire_minutes = IntField(default=30, min_value=1)
    refresh_token_expire_days = IntField(default=30, min_value=1)
    email_verification_expire_hours = IntField(default=24, min_value=1)
    login_rate_limit_per_minute = IntField(default=5, min_value=1)
    register_rate_limit_per_minute = IntField(default=5, min_value=1)
    # Platform-wide banner shown to every visitor (logged in or not) via
    # GET /announcement — separate from the personal, condition-based
    # banners in Navbar (email/identity verification).
    announcement_message = StringField(max_length=280)
    announcement_active = BooleanField(default=False)
    updated_by = ReferenceField("User")
    updated_at = DateTimeField(default=datetime.utcnow)

    meta = {"collection": "platform_settings"}
