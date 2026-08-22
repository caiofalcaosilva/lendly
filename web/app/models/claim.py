from mongoengine import (
    DateTimeField,
    Document,
    IntField,
    ListField,
    ReferenceField,
    StringField,
)

from app.utils.time import utcnow

CLAIM_STATUSES = [
    "pending",
    "approved",
    "overdue",
    "advanced_by_lendly",
    "cancelled",
    "rejected",
    "paid",
]


class Claim(Document):
    """A damage/loss claim filed by an item's owner, opened only within
    platform_settings.claim_filing_window_hours of the owner confirming
    the item's return (see claim_service.create_claim). Money fields are
    integer cents (see app.utils.money). requested_amount_cents/
    approved_amount_cents are both capped by the item's declared_value_cents
    at the time of filing — see claim_service.create_claim/approve_claim.

    Status machine: pending -> approved (admin sets approved_amount_cents,
    a real Pix charge from requester to owner is created — see
    payment_service.create_payment_for_claim) -> paid (webhook confirms
    the charge, automatic) OR overdue (claim_overdue_service, deadline
    passed unpaid) -> paid (paid late) OR advanced_by_lendly (owner-paid
    items only — admin manually transferred the owner, requester now owes
    the platform instead, see claim_service.advance_paid_by_lendly) ->
    paid (debt settled). pending -> rejected (admin declines). approved/
    overdue -> cancelled (admin voids it, see claim_service.cancel_claim).

    The active/most-recent charge for a claim is found via
    Payment.objects(claim=claim) — not stored here, since it can change
    (original charge -> debt-to-platform charge) and losing that history
    would hide exactly the kind of thing an admin needs to audit."""

    loan_request = ReferenceField("LoanRequest", required=True)
    item = ReferenceField("Item", required=True)
    owner = ReferenceField("User", required=True)
    requester = ReferenceField("User", required=True)
    description = StringField(required=True, max_length=1000)
    requested_amount_cents = IntField(required=True, min_value=1)
    photos = ListField(StringField(), default=list)
    status = StringField(default="pending", choices=CLAIM_STATUSES)
    approved_amount_cents = IntField(min_value=0)
    rejection_reason = StringField(max_length=500)
    reviewed_by = ReferenceField("User")
    reviewed_at = DateTimeField()
    paid_at = DateTimeField()
    advanced_at = DateTimeField()
    cancelled_at = DateTimeField()
    cancellation_reason = StringField(max_length=500)
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "claims",
        "indexes": ["loan_request", "status", "owner"],
    }
