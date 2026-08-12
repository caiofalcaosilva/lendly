from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    EmailField,
    EmbeddedDocument,
    EmbeddedDocumentField,
    FloatField,
    IntField,
    ListField,
    ReferenceField,
    StringField,
)

from app.utils.time import utcnow


class RefreshSession(EmbeddedDocument):
    token_hash = StringField(required=True)
    created_at = DateTimeField(default=utcnow)
    expires_at = DateTimeField(required=True)
    revoked_at = DateTimeField()
    ip_address = StringField(max_length=45)  # long enough for IPv6
    user_agent = StringField(max_length=300)


class NotificationPreferences(EmbeddedDocument):
    """Only the convenience emails are toggleable — security-relevant ones
    (verification links, password reset, new-login alerts) always send,
    same reasoning as why 2FA can't be turned off without a valid code."""

    request_status = BooleanField(default=True)
    new_message = BooleanField(default=True)
    verification_result = BooleanField(default=True)
    item_available = BooleanField(default=True)
    review_reminder = BooleanField(default=True)


class InAppNotificationPreferences(EmbeddedDocument):
    """Same 5 categories as NotificationPreferences, but for the in-app
    bell — deliberately a separate toggle set, so turning off email for a
    category doesn't also mute the bell, and vice versa. Also has 2
    bell-only categories with no email equivalent at all (see
    app.utils.notifications._INAPP_ONLY_CATEGORIES)."""

    request_status = BooleanField(default=True)
    new_message = BooleanField(default=True)
    verification_result = BooleanField(default=True)
    item_available = BooleanField(default=True)
    review_reminder = BooleanField(default=True)
    group_vouch = BooleanField(default=True)
    favorite_item_changed = BooleanField(default=True)
    group_new_item = BooleanField(default=True)
    group_membership_changed = BooleanField(default=True)


class User(Document):
    name = StringField(required=True, max_length=100)
    email = EmailField(required=True, unique=True)
    phone = StringField(max_length=20)
    avatar_url = StringField(max_length=300)
    bio = StringField(max_length=500)
    # Capped at 3 by featured_items_service.set_featured_items, not enforced here.
    featured_items = ListField(ReferenceField("Item"))
    favorite_users = ListField(ReferenceField("User"), default=list)
    zip_code = StringField(max_length=10)
    latitude = FloatField()
    longitude = FloatField()
    street = StringField(max_length=200)
    number = StringField(max_length=20)
    complement = StringField(max_length=100)
    neighborhood = StringField(max_length=100)
    city = StringField(max_length=100)
    state = StringField(max_length=2)
    password_hash = StringField(required=True)
    is_active = BooleanField(default=True)
    # Self-service, reversible — unlike is_active=False, which is only ever
    # reached via account deletion. Hides items and blocks new requests
    # without touching login or any other data.
    is_paused = BooleanField(default=False)
    is_admin = BooleanField(default=False)
    status_changed_by = ReferenceField("User")
    status_changed_at = DateTimeField()
    admin_status_changed_by = ReferenceField("User")
    admin_status_changed_at = DateTimeField()
    account_type = StringField(default="individual", choices=["individual", "business"])
    company_name = StringField(max_length=150)
    trade_name = StringField(max_length=150)
    cnpj = StringField(max_length=18, sparse=True, unique=True)
    business_category = StringField(max_length=100)
    business_phone = StringField(max_length=20)
    business_hours = StringField(max_length=200)
    website = StringField(max_length=200)
    instagram = StringField(max_length=100)
    whatsapp = StringField(max_length=20)
    cpf = StringField(max_length=14, sparse=True, unique=True)
    identity_status = StringField(
        default="none", choices=["none", "pending", "approved", "rejected"]
    )
    mp_user_id = StringField()
    # Encrypted at rest (app/utils/crypto.py) — must stay recoverable to
    # call the API on the seller's behalf, so a hash won't do.
    mp_access_token = StringField()
    mp_refresh_token = StringField()
    mp_token_expires_at = DateTimeField()
    mp_connected_at = DateTimeField()
    mp_oauth_state = StringField()
    is_verified = BooleanField(default=False)
    # Recorded at registration for LGPD consent evidence — which version of
    # the terms/privacy policy they agreed to, and when/from where.
    terms_accepted_version = StringField()
    terms_accepted_at = DateTimeField()
    terms_accepted_ip = StringField()
    email_verification_token = StringField()
    email_verification_expires = DateTimeField()
    password_reset_token = StringField()
    password_reset_expires = DateTimeField()
    totp_secret = StringField()
    totp_enabled = BooleanField(default=False)
    trusted_devices = ListField(StringField(), default=list)
    refresh_sessions = ListField(EmbeddedDocumentField(RefreshSession), default=list)
    notification_prefs = EmbeddedDocumentField(
        NotificationPreferences, default=NotificationPreferences
    )
    inapp_notification_prefs = EmbeddedDocumentField(
        InAppNotificationPreferences, default=InAppNotificationPreferences
    )
    favorites = ListField(ReferenceField("Item"), default=list)
    average_rating = FloatField(default=0.0)
    rating_count = IntField(default=0)
    reliability_score = FloatField()
    reliability_count = IntField(default=0)
    on_time_rate = FloatField()
    avg_response_minutes = FloatField()
    response_count = IntField(default=0)
    finished_loans_count = IntField(default=0)
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "users",
        "strict": False,
        "indexes": [
            {"fields": ["email"], "unique": True},
            "email_verification_token",
            "password_reset_token",
            "created_at",
            "account_type",
            "status_changed_by",
            "admin_status_changed_by",
            "refresh_sessions.token_hash",
        ],
    }
