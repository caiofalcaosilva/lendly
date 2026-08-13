from mongoengine import DateTimeField, Document, FloatField, ReferenceField, StringField

from app.utils.time import utcnow

PAYMENT_STATUSES = ["pending", "held", "released", "refunded", "failed"]
PAYMENT_KINDS = ["rental", "extension"]


class Payment(Document):
    """See docs/pagamento-online.md for the state machine. gross_amount/
    platform_fee_amount are snapshotted at charge time, never recomputed
    from Item.daily_rate later.

    `kind="rental"` is the original charge for the loan itself — exactly
    one per paid LoanRequest. `kind="extension"` is a separate charge for
    extra days on an approved prorrogação — a LoanRequest can accumulate
    several of these over its lifetime (nothing stops asking for another
    extension after a previous one was approved), so `loan_request` is
    NOT unique here."""

    loan_request = ReferenceField("LoanRequest", required=True)
    kind = StringField(default="rental", choices=PAYMENT_KINDS)
    payer = ReferenceField("User", required=True)
    payee = ReferenceField("User", required=True)
    gross_amount = FloatField(required=True, min_value=0)
    platform_fee_amount = FloatField(required=True, min_value=0)
    # Slice of gross_amount that funds the damage/loss claims pool — folded
    # into gross_amount (the requester pays it) but tracked separately from
    # platform_fee_amount so the two can be reported independently. 0 for
    # any item without a declared_value. See claim_service.get_fund_summary.
    guarantee_fee_amount = FloatField(default=0.0, min_value=0)
    status = StringField(default="pending", choices=PAYMENT_STATUSES)
    mp_payment_id = StringField()
    # Cached so the checkout screen can re-render on refresh without
    # re-hitting Mercado Pago; expires_at flags when to ask for a fresh one.
    pix_qr_code = StringField()
    pix_qr_code_base64 = StringField()
    expires_at = DateTimeField()
    created_at = DateTimeField(default=utcnow)
    held_at = DateTimeField()
    released_at = DateTimeField()
    refunded_at = DateTimeField()

    meta = {
        "collection": "payments",
        "indexes": ["mp_payment_id", {"fields": ["loan_request", "kind"]}],
    }
