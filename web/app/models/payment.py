from mongoengine import (
    DateTimeField,
    Document,
    EmbeddedDocument,
    EmbeddedDocumentField,
    IntField,
    ReferenceField,
    StringField,
)

from app.utils.time import utcnow

PAYMENT_STATUSES = ["pending", "held", "released", "refunded", "failed", "superseded"]
PAYMENT_KINDS = ["rental", "extension", "claim", "claim_debt"]


class PixCharge(EmbeddedDocument):
    """Cached so the checkout screen can re-render on refresh without
    re-hitting Mercado Pago; expires_at flags when to ask for a fresh one
    (currently always None — Mercado Pago's create-order response never
    includes an expiry, kept for when/if that changes)."""

    mp_payment_id = StringField()
    qr_code = StringField()
    qr_code_base64 = StringField()
    expires_at = DateTimeField()


class Payment(Document):
    """See docs/pagamento-online.md for the state machine. Money fields are
    integer cents (see app.utils.money) — gross_amount_cents/
    platform_fee_amount_cents are snapshotted at charge time, never
    recomputed from Item.daily_rate_cents later.

    `kind="rental"` is the original charge for the loan itself — exactly
    one per paid LoanRequest. `kind="extension"` is a separate charge for
    extra days on an approved prorrogação — a LoanRequest can accumulate
    several of these over its lifetime (nothing stops asking for another
    extension after a previous one was approved), so `loan_request` is
    NOT unique here. `kind="claim"` charges the requester on behalf of a
    Claim, payee=the item's owner, no platform_fee/guarantee_fee (see
    claim_service/payment_service.create_payment_for_claim). `kind=
    "claim_debt"` is the same idea but payee=the platform's own system
    account (see system_account_service) and seller_access_token is
    settings.MP_ACCESS_TOKEN directly rather than an OAuth'd seller's —
    used only when the platform manually advanced a claim's owner and
    now needs to collect that back from the requester, plus a late fee
    (see claim_service.advance_paid_by_lendly). `claim`/`claim_debt`
    Payments reference the Claim they belong to (see `claim` field
    below); a Claim can accumulate more than one over time (the original
    charge gets superseded if the platform ends up advancing the owner),
    so — same as loan_request above — `claim` is NOT unique here."""

    loan_request = ReferenceField("LoanRequest", required=True)
    claim = ReferenceField("Claim")
    kind = StringField(default="rental", choices=PAYMENT_KINDS)
    payer = ReferenceField("User", required=True)
    payee = ReferenceField("User", required=True)
    gross_amount_cents = IntField(required=True, min_value=0)
    platform_fee_amount_cents = IntField(required=True, min_value=0)
    # Slice of gross_amount_cents that funds the damage/loss claims pool —
    # folded into gross_amount_cents (the requester pays it) but tracked
    # separately from platform_fee_amount_cents so the two can be reported
    # independently. 0 for any item without a declared_value. See
    # claim_service.get_fund_summary.
    guarantee_fee_amount_cents = IntField(default=0, min_value=0)
    status = StringField(default="pending", choices=PAYMENT_STATUSES)
    pix_charge = EmbeddedDocumentField(PixCharge)
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "payments",
        "indexes": [
            "pix_charge.mp_payment_id",
            "status",
            "payer",
            {"fields": ["loan_request", "kind"]},
            {"fields": ["claim", "kind"]},
        ],
    }
