from mongoengine import DateTimeField, Document, ReferenceField, StringField

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
        ],
    }
