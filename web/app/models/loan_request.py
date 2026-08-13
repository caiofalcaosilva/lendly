from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
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
# docs/pagamento-online.md for the full state machine.
PAYMENT_STATUSES = ["unpaid", "processing", "held", "released", "refunded", "failed"]


class LoanRequest(Document):
    item = ReferenceField("Item", required=True)
    requester = ReferenceField("User", required=True)
    owner = ReferenceField("User", required=True)
    status = StringField(default="pending", choices=REQUEST_STATUSES)
    payment_status = StringField(default="unpaid", choices=PAYMENT_STATUSES)
    pickup_date = DateTimeField(required=True)
    expected_return_date = DateTimeField(required=True)
    actual_return_date = DateTimeField()
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
    # that never happened. `*_forced` marks the owner-only escape hatch used
    # when the other side never confirms (see loan_request_service.lifecycle).
    pickup_confirmed_by_owner_at = DateTimeField()
    pickup_confirmed_by_requester_at = DateTimeField()
    pickup_forced = BooleanField(default=False)
    # Delivery-fulfilled requests skip the dual-confirmation dance above:
    # the requester is shown this code once accepted, hands it to the owner
    # at the door, and the owner typing it in sets both *_confirmed_by_*_at
    # fields at once (see loan_request_service.lifecycle.confirm_pickup_by_code).
    delivery_confirmation_code = StringField(max_length=6)
    delivery_confirmation_code_attempts = IntField(default=0)
    delivery_confirmation_code_generated_at = DateTimeField()
    return_confirmed_by_owner_at = DateTimeField()
    return_confirmed_by_requester_at = DateTimeField()
    return_forced = BooleanField(default=False)
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
            {"fields": ["status", "review_reminder_sent_at"]},
        ],
    }
