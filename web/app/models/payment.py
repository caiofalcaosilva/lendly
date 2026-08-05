from mongoengine import DateTimeField, Document, FloatField, ReferenceField, StringField

from app.utils.time import utcnow

# unpaid never applies to a Payment doc (that's the free-item / no-payment-
# created-yet state, tracked on LoanRequest.payment_status instead).
PAYMENT_STATUSES = ["pending", "held", "released", "refunded", "failed"]


class Payment(Document):
    """One per paid LoanRequest. amount/platform_fee_amount are snapshotted
    at charge time — never recomputed from Item.daily_rate later, so an
    owner editing their price afterwards can't retroactively change what
    was actually charged. See docs/pagamento-online.md for the full
    held → released state machine (charged at accept, released at
    pickup check-in, refunded on cancel-before-pickup)."""

    loan_request = ReferenceField("LoanRequest", required=True, unique=True)
    payer = ReferenceField("User", required=True)
    payee = ReferenceField("User", required=True)
    gross_amount = FloatField(required=True, min_value=0)
    platform_fee_amount = FloatField(required=True, min_value=0)
    status = StringField(default="pending", choices=PAYMENT_STATUSES)

    # Mercado Pago identifiers — kept as plain strings, not sensitive like
    # the OAuth tokens on User, just references for lookup/idempotency.
    mp_payment_id = StringField()

    # Pix QR data, cached so the requester's checkout screen can re-render
    # the same code on refresh without re-hitting Mercado Pago. Pix QR
    # codes expire — expires_at lets the frontend know when to ask for a
    # fresh one instead of showing a dead code.
    pix_qr_code = StringField()
    pix_qr_code_base64 = StringField()
    expires_at = DateTimeField()

    created_at = DateTimeField(default=utcnow)
    held_at = DateTimeField()
    released_at = DateTimeField()
    refunded_at = DateTimeField()

    meta = {
        "collection": "payments",
        # loan_request already has its own unique index from `unique=True`
        # above. payer/payee used to be indexed here too, but nothing
        # queries a Payment by either today — dropped as dead weight.
        "indexes": ["mp_payment_id"],
    }
