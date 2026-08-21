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

from app.models._choices import BRAZIL_STATES
from app.utils.time import utcnow


class RefreshSession(EmbeddedDocument):
    token_hash = StringField(required=True)
    created_at = DateTimeField(default=utcnow)
    expires_at = DateTimeField(required=True)
    revoked_at = DateTimeField()
    ip_address = StringField(max_length=45)  # long enough for IPv6
    user_agent = StringField(max_length=300)


class PushSubscription(EmbeddedDocument):
    endpoint = StringField(required=True)
    p256dh = StringField(required=True)
    auth = StringField(required=True)
    created_at = DateTimeField(default=utcnow)


class GoogleConnection(EmbeddedDocument):
    """Google's own stable user id ("sub" claim) plus connect-flow
    bookkeeping — set only for accounts that signed up or linked via
    Google (google_oauth_gateway.py). Uniqueness on google_id is enforced
    via User.meta['indexes'] (a nested field can't carry unique=True on
    the field itself)."""

    google_id = StringField()
    connected_at = DateTimeField()
    oauth_state = StringField()


class TermsAcceptance(EmbeddedDocument):
    """Recorded at registration for LGPD consent evidence — which version
    of the terms/privacy policy they agreed to, and when/from where.
    Write-only: nothing reads this back today, kept purely as evidence."""

    version = StringField()
    accepted_at = DateTimeField()
    ip_address = StringField()


class BusinessProfile(EmbeddedDocument):
    """Only present when account_type="business" — an individual account
    has no business_profile at all, not one with blank fields.

    cnpj is encrypted at rest (app/utils/crypto.py) — LGPD-sensitive PII,
    same treatment as User.cpf. Fernet ciphertext isn't deterministic (two
    encryptions of the same CNPJ differ), so it can't carry the uniqueness
    constraint itself: cnpj_hash (a deterministic SHA-256 blind index, see
    app/utils/crypto.py::digits_hash) does that instead, and is what
    every exact-match lookup filters on. Its unique+sparse index lives on
    User.meta['indexes'] as a nested path, same reason as
    GoogleConnection.google_id."""

    company_name = StringField(max_length=150)
    trade_name = StringField(max_length=150)
    cnpj = StringField()
    cnpj_hash = StringField()
    business_category = StringField(max_length=100)
    business_phone = StringField(max_length=20)
    business_hours = StringField(max_length=200)
    website = StringField(max_length=200)
    instagram = StringField(max_length=100)
    whatsapp = StringField(max_length=20)


class PhoneVerification(EmbeddedDocument):
    """A code in flight for User.phone — only present while a verification
    attempt is active (mirrors LoanRequest.DeliveryCode), cleared on
    success or when a new phone is saved. Unlike DeliveryCode, this one
    also expires by time (SMS is easier to intercept than a code shown
    only to the requester on-screen)."""

    code = StringField(max_length=6)
    attempts = IntField(default=0)
    generated_at = DateTimeField()
    expires_at = DateTimeField()


class MercadoPagoConnection(EmbeddedDocument):
    """OAuth connection to the seller's own Mercado Pago account — see
    mp_connect_service.py. access_token/refresh_token are encrypted at
    rest (app/utils/crypto.py); must stay recoverable to call the API on
    the seller's behalf, so a hash won't do."""

    mp_user_id = StringField()
    access_token = StringField()
    refresh_token = StringField()
    token_expires_at = DateTimeField()
    connected_at = DateTimeField()
    oauth_state = StringField()


class ReputationStats(EmbeddedDocument):
    """Denormalized, recomputed by review_service.recalculate_rating and
    loan_request_service/reliability.py — always present (default=) since
    every user has these stats, even if still at their zero-value."""

    average_rating = FloatField(default=0.0)
    rating_count = IntField(default=0)
    reliability_score = FloatField()
    reliability_count = IntField(default=0)
    on_time_rate = FloatField()
    avg_response_minutes = FloatField()
    response_count = IntField(default=0)
    finished_loans_count = IntField(default=0)


class LoginLockout(EmbeddedDocument):
    """Per-account brute-force guard, separate from the IP-based rate
    limit on POST /auth/login (which a distributed attacker can just
    route around) — failed_attempts resets to 0 on any successful login;
    locked_until is only set once the platform-configured max is hit."""

    failed_attempts = IntField(default=0)
    locked_until = DateTimeField()


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


class Address(EmbeddedDocument):
    """The user's own home address — always present (default=), even if
    every field is still blank. Item/Group keep their own separate flat
    address fields (denormalized from this one at creation time), not
    embedded — out of scope here, see the User-only decision this was
    scoped to."""

    zip_code = StringField(max_length=10)
    latitude = FloatField()
    longitude = FloatField()
    street = StringField(max_length=200)
    number = StringField(max_length=20)
    complement = StringField(max_length=100)
    neighborhood = StringField(max_length=100)
    city = StringField(max_length=100)
    state = StringField(max_length=2, choices=BRAZIL_STATES)


class User(Document):
    name = StringField(required=True, max_length=100)
    email = EmailField(required=True, unique=True)
    phone = StringField(max_length=20)
    phone_verified = BooleanField(default=False)
    phone_verification = EmbeddedDocumentField(PhoneVerification)
    avatar_url = StringField(max_length=300)
    bio = StringField(max_length=500)
    # Capped at 3 by featured_items_service.set_featured_items, not enforced here.
    featured_items = ListField(ReferenceField("Item"))
    favorite_users = ListField(ReferenceField("User"), default=list)
    address = EmbeddedDocumentField(Address, default=Address)
    # Optional — absent for accounts created via "Continuar com Google"
    # (see auth_service/google.py), which have no password to check against.
    password_hash = StringField()
    google_connection = EmbeddedDocumentField(GoogleConnection)
    is_active = BooleanField(default=True)
    # Self-service, reversible — unlike is_active=False, which is only ever
    # reached via account deletion. Hides items and blocks new requests
    # without touching login or any other data.
    is_paused = BooleanField(default=False)
    # Different from is_paused above: set only by claim_overdue_service
    # when a claim payment (rental or debt-to-platform) goes unpaid past
    # its deadline. Blocks new loan requests/item listings only (see the
    # gates in loan_request_service.lifecycle/item_service.crud) — login,
    # browsing, and paying off the debt itself all keep working. Cleared
    # automatically once the relevant Payment is confirmed (see
    # payment_service.handle_webhook), or by an admin cancelling the
    # claim (claim_service.cancel_claim).
    is_restricted = BooleanField(default=False)
    restricted_reason = StringField(max_length=300)
    restricted_at = DateTimeField()
    # The one sentinel account that receives kind="claim_debt" Payments —
    # see system_account_service.get_system_account(). is_active=False so
    # it's naturally excluded from the ~15 places that filter on that
    # field (public listings, login, dashboard counts, etc.).
    is_system_account = BooleanField(default=False)
    is_admin = BooleanField(default=False)
    status_changed_by = ReferenceField("User")
    status_changed_at = DateTimeField()
    admin_status_changed_by = ReferenceField("User")
    admin_status_changed_at = DateTimeField()
    account_type = StringField(default="individual", choices=["individual", "business"])
    business_profile = EmbeddedDocumentField(BusinessProfile)
    # Encrypted at rest, same reasoning/pattern as BusinessProfile.cnpj —
    # cpf_hash (below, in meta.indexes) carries the unique+sparse
    # constraint and every exact-match lookup instead.
    cpf = StringField(sparse=True)
    cpf_hash = StringField(sparse=True, unique=True)
    identity_status = StringField(
        default="none", choices=["none", "pending", "approved", "rejected"]
    )
    mp_connection = EmbeddedDocumentField(MercadoPagoConnection)
    is_verified = BooleanField(default=False)
    terms_acceptance = EmbeddedDocumentField(TermsAcceptance)
    email_verification_token = StringField()
    email_verification_expires = DateTimeField()
    password_reset_token = StringField()
    password_reset_expires = DateTimeField()
    totp_secret = StringField()
    totp_enabled = BooleanField(default=False)
    trusted_devices = ListField(StringField(), default=list)
    refresh_sessions = ListField(EmbeddedDocumentField(RefreshSession), default=list)
    push_subscriptions = ListField(
        EmbeddedDocumentField(PushSubscription), default=list
    )
    notification_prefs = EmbeddedDocumentField(
        NotificationPreferences, default=NotificationPreferences
    )
    inapp_notification_prefs = EmbeddedDocumentField(
        InAppNotificationPreferences, default=InAppNotificationPreferences
    )
    favorites = ListField(ReferenceField("Item"), default=list)
    reputation = EmbeddedDocumentField(ReputationStats, default=ReputationStats)
    login_lockout = EmbeddedDocumentField(LoginLockout, default=LoginLockout)
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
            "favorites",
            {
                "fields": ["google_connection.google_id"],
                "unique": True,
                "sparse": True,
            },
            {
                "fields": ["business_profile.cnpj_hash"],
                "unique": True,
                "sparse": True,
            },
        ],
    }
