from mongoengine import DateTimeField, Document, FloatField, ReferenceField, StringField

from app.utils.time import utcnow

PAYMENT_STATUSES = ["pending", "held", "released", "refunded", "failed"]


class Payment(Document):
    """One per paid LoanRequest — see docs/pagamento-online.md for the
    state machine. gross_amount/platform_fee_amount are snapshotted at
    charge time, never recomputed from Item.daily_rate later."""

    loan_request = ReferenceField("LoanRequest", required=True, unique=True)
    payer = ReferenceField("User", required=True)
    payee = ReferenceField("User", required=True)
    gross_amount = FloatField(required=True, min_value=0)
    platform_fee_amount = FloatField(required=True, min_value=0)
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

    meta = {"collection": "payments", "indexes": ["mp_payment_id"]}
