from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    FloatField,
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
    phone_verification_expire_minutes = IntField(default=10, min_value=1)
    phone_verification_rate_limit_per_minute = IntField(default=3, min_value=1)
    chat_message_rate_limit_per_minute = IntField(default=20, min_value=1)
    password_reset_rate_limit_per_minute = IntField(default=3, min_value=1)
    group_create_rate_limit_per_minute = IntField(default=5, min_value=1)
    group_post_rate_limit_per_minute = IntField(default=20, min_value=1)
    # How long an owner must wait, after confirming pickup/return on their
    # own side, before forcing the transition through without the other
    # party's confirmation (see loan_request_service.lifecycle).
    handoff_confirmation_grace_hours = IntField(default=2, min_value=1)
    # How long, after the OWNER confirms an item's return, they have to
    # file a claim (see claim_service.create_claim) — anchored on the
    # owner's own confirmation, not the LoanRequest reaching "finished",
    # since the other side confirming last would otherwise leave the
    # owner with no window at all.
    claim_filing_window_hours = IntField(default=2, min_value=1)
    # How long the requester has to pay an approved claim's Pix charge
    # before claim_overdue_service marks it overdue and restricts their
    # account (see User.is_restricted).
    claim_payment_deadline_days = IntField(default=7, min_value=1)
    # Extra fraction charged when the platform has to advance a paid
    # item's owner and collect the debt back from the requester instead
    # (see claim_service.advance_paid_by_lendly) — stored as a fraction
    # (0.05 = 5%), same convention as settings.PLATFORM_FEE_PERCENT/
    # GUARANTEE_FEE_PERCENT (env-var based, unrelated to this admin-
    # configurable field).
    claim_late_fee_percent = FloatField(default=0.05, min_value=0)
    announcement_message = StringField(max_length=280)
    announcement_active = BooleanField(default=False)
    updated_by = ReferenceField("User")
    updated_at = DateTimeField(default=utcnow)

    meta = {"collection": "platform_settings"}
