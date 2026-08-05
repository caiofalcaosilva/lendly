from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
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
