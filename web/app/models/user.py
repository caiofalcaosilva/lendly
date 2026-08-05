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


class User(Document):
    name = StringField(required=True, max_length=100)
    email = EmailField(required=True, unique=True)
    phone = StringField(max_length=20)
    # address
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
    is_admin = BooleanField(default=False)
    # Who last flipped is_active via /admin/users and when — feeds the
    # admin action history (see admin_action_service). Not set by
    # self-service account deletion, only by an admin's activate/deactivate.
    status_changed_by = ReferenceField("User")
    status_changed_at = DateTimeField()
    # Same idea, but for is_admin (promote/demote via /admin/users) — kept
    # separate from status_changed_by/at above so promoting someone doesn't
    # overwrite the record of their last activate/deactivate, or vice versa.
    admin_status_changed_by = ReferenceField("User")
    admin_status_changed_at = DateTimeField()
    # Business account (see roadmap "Contas de empresas") — fields below are
    # only populated when account_type="business"; `name` stays the human
    # managing the account, `company_name`/`trade_name` are the business.
    account_type = StringField(default="individual", choices=["individual", "business"])
    company_name = StringField(max_length=150)
    trade_name = StringField(max_length=150)
    cnpj = StringField(max_length=18, sparse=True, unique=True)
    business_category = StringField(max_length=100)
    business_phone = StringField(max_length=20)
    business_hours = StringField(max_length=200)
    website = StringField(max_length=200)
    # Identity verification (see VerificationSubmission) — cpf is set once a
    # submission is made; identity_status mirrors the latest submission's
    # outcome so other code can check it without a join.
    cpf = StringField(max_length=14, sparse=True, unique=True)
    identity_status = StringField(
        default="none", choices=["none", "pending", "approved", "rejected"]
    )
    # Mercado Pago account connection — required before this user can create
    # a paid item (see item_service.create_item). Tokens are encrypted at
    # rest (app/utils/crypto.py) since, unlike a password hash, they must be
    # recoverable to call the API on the seller's behalf.
    mp_user_id = StringField()
    mp_access_token = StringField()
    mp_refresh_token = StringField()
    mp_token_expires_at = DateTimeField()
    mp_connected_at = DateTimeField()
    # CSRF state for the OAuth connect flow — set when the authorization URL
    # is generated, checked and cleared on callback so a forged/replayed
    # callback (guessed or leaked code) can't complete without also
    # matching the state this same session issued.
    mp_oauth_state = StringField()
    # Email verification
    is_verified = BooleanField(default=False)
    email_verification_token = StringField()
    email_verification_expires = DateTimeField()
    # 2FA (TOTP)
    totp_secret = StringField()
    totp_enabled = BooleanField(default=False)
    # Trusted devices (list of device UUIDs)
    trusted_devices = ListField(StringField(), default=list)
    refresh_sessions = ListField(EmbeddedDocumentField(RefreshSession), default=list)
    favorites = ListField(ReferenceField("Item"), default=list)
    average_rating = FloatField(default=0.0)
    rating_count = IntField(default=0)
    # Behavioral reliability score (0-100), distinct from average_rating —
    # see loan_request_service._recalculate_reliability. None until the
    # user has at least one qualifying loan-request event.
    reliability_score = FloatField()
    reliability_count = IntField(default=0)
    # % of finished loans (as requester) returned by the expected date.
    # Narrower than reliability_score — ignores refusals/cancellations,
    # only measures on-time returns. See _recalculate_reliability.
    on_time_rate = FloatField()
    finished_loans_count = IntField(default=0)
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "users",
        "strict": False,
        "indexes": [
            {"fields": ["email"], "unique": True},
            "city",
            "state",
            "neighborhood",
            "refresh_sessions.token_hash",
        ],
    }
