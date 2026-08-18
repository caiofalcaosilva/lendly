from mongoengine import (
    DateTimeField,
    Document,
    FloatField,
    ListField,
    ReferenceField,
    StringField,
)

from app.utils.time import utcnow

CLAIM_STATUSES = ["pending", "approved", "rejected", "paid"]


class Claim(Document):
    """A damage/loss claim filed by an item's owner after a finished paid
    rental, against the guarantee pool funded by Payment.guarantee_fee_amount
    (see claim_service.get_fund_summary). requested_amount/approved_amount
    are both capped by the item's declared_value at the time of filing —
    see claim_service.create_claim/approve_claim.

    Approval is two steps: `approved` records the admin's decision (no
    automated payout exists), `paid` records that the owner was actually
    transferred the money outside the platform."""

    loan_request = ReferenceField("LoanRequest", required=True)
    item = ReferenceField("Item", required=True)
    owner = ReferenceField("User", required=True)
    requester = ReferenceField("User", required=True)
    description = StringField(required=True, max_length=1000)
    requested_amount = FloatField(required=True, min_value=0.01)
    photos = ListField(StringField(), default=list)
    status = StringField(default="pending", choices=CLAIM_STATUSES)
    approved_amount = FloatField(min_value=0)
    rejection_reason = StringField(max_length=500)
    reviewed_by = ReferenceField("User")
    reviewed_at = DateTimeField()
    paid_by = ReferenceField("User")
    paid_at = DateTimeField()
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "claims",
        "indexes": ["loan_request", "status", "owner"],
    }
