from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    EmbeddedDocument,
    EmbeddedDocumentField,
    IntField,
    ReferenceField,
    StringField,
)

from app.utils.time import utcnow

REQUEST_STATUSES = [
    "pending",
    "accepted",
    "refused",
    "in_progress",
    "finished",
    "cancelled",
]
# Payment side of a paid loan, kept separate from `status` — see
# docs/pagamento-online.md for the full state machine. Deliberately its own
# name, not PAYMENT_STATUSES (that's Payment.status, in models/payment.py) —
# the two track different things from different angles (this request-level
# field has "unpaid"/"processing" states that exist before any Payment
# document is even created) and used to share the same name by accident,
# which invited comparing a LoanRequest against the wrong value set.
LOAN_PAYMENT_STATUSES = [
    "unpaid",
    "processing",
    "held",
    "released",
    "refunded",
    "failed",
]


class PickupConfirmation(EmbeddedDocument):
    """Both sides must confirm before the request actually advances to
    in_progress — see loan_request_service.lifecycle.confirm_pickup.
    forced marks the owner-only escape hatch used when the requester
    never confirms."""

    confirmed_by_owner_at = DateTimeField()
    confirmed_by_requester_at = DateTimeField()
    forced = BooleanField(default=False)


class ReturnConfirmation(EmbeddedDocument):
    """Same dual-confirmation shape as PickupConfirmation, for the return
    side — see loan_request_service.lifecycle.confirm_return."""

    confirmed_by_owner_at = DateTimeField()
    confirmed_by_requester_at = DateTimeField()
    forced = BooleanField(default=False)


class DeliveryCode(EmbeddedDocument):
    """Only present for delivery-fulfilled requests — the requester is
    shown this code once accepted, hands it to the owner at the door, and
    the owner typing it in sets both PickupConfirmation *_at fields at
    once (see lifecycle.confirm_pickup_by_code)."""

    code = StringField(max_length=6)
    attempts = IntField(default=0)
    generated_at = DateTimeField()


class LoanRequest(Document):
    item = ReferenceField("Item", required=True)
    requester = ReferenceField("User", required=True)
    owner = ReferenceField("User", required=True)
    status = StringField(default="pending", choices=REQUEST_STATUSES)
    payment_status = StringField(default="unpaid", choices=LOAN_PAYMENT_STATUSES)
    pickup_date = DateTimeField(required=True)
    expected_return_date = DateTimeField(required=True)
    actual_return_date = DateTimeField()
    # How many units of the item this specific request reserves — see
    # loan_request_service._common.reserved_quantity for how this combines
    # with Item.quantity_total to block over-committing a date range.
    # Existing requests predate this field and default to 1, matching how
    # they already behaved (one item = one unit).
    quantity = IntField(min_value=1, default=1)
    # How this specific request is fulfilled — chosen at creation time from
    # the item's allowed fulfillment_options. Existing requests predate this
    # field and default to "pickup", so their dual-confirmation flow below
    # is untouched.
    fulfillment_method = StringField(choices=["pickup", "delivery"], default="pickup")
    notes = StringField(max_length=500)
    cancelled_by = ReferenceField("User")
    requested_extension_date = DateTimeField()
    extension_status = StringField(
        default="none", choices=["none", "pending", "approved", "rejected"]
    )
    # Set once, at accept/refuse — unlike updated_at, later transitions
    # (in_progress, finished...) don't touch it, so it stays a clean
    # "how long did the owner take to decide" signal.
    responded_at = DateTimeField()
    # Pickup/return each require both sides to confirm before the status
    # actually advances — an owner acting alone can't fabricate a handoff
    # that never happened. See PickupConfirmation/ReturnConfirmation above
    # and loan_request_service.lifecycle.
    pickup_confirmation = EmbeddedDocumentField(
        PickupConfirmation, default=PickupConfirmation
    )
    return_confirmation = EmbeddedDocumentField(
        ReturnConfirmation, default=ReturnConfirmation
    )
    # Only present for delivery-fulfilled requests — see DeliveryCode above.
    delivery_confirmation = EmbeddedDocumentField(DeliveryCode)
    # One-shot flag — set the first time the review-reminder job checks this
    # request, whether or not it actually had anything to remind about.
    review_reminder_sent_at = DateTimeField()
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "loan_requests",
        "indexes": [
            "status",
            {"fields": ["requester", "status"]},
            {"fields": ["owner", "status"]},
            {"fields": ["cancelled_by", "status"]},
            {"fields": ["item", "status"]},
            # Backs the date-range overlap query in reserved_quantity —
            # item+status alone (the index above) can't serve a range scan
            # on pickup_date efficiently.
            {"fields": ["item", "status", "pickup_date"]},
            {"fields": ["status", "review_reminder_sent_at"]},
        ],
    }
