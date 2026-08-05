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
# Deliberately a field parallel to `status`, not a new status value — keeps
# every place that already switches on REQUEST_STATUSES (schemas, frontend
# badges, filters) untouched. unpaid = free item or payment not started yet;
# processing = Pix charge created, awaiting confirmation; held = paid,
# money retained pending pickup; released = paid out to the owner at
# check-in; refunded = cancelled before pickup. See Payment for the ledger.
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
    # Extension request — requester asks for more days while in_progress.
    # Only one pending extension at a time; requester can ask again after
    # a rejection.
    requested_extension_date = DateTimeField()
    extension_status = StringField(
        default="none", choices=["none", "pending", "approved", "rejected"]
    )
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "loan_requests",
        "indexes": [
            # Standalone — the 4 admin-dashboard status counts filter on
            # this alone, which none of the compounds below can serve
            # (status isn't the leftmost field in any of them).
            "status",
            # reliability_service.recalculate_reliability runs one of these
            # three on every accept/refuse/finish/cancel transition. Each
            # compound's leftmost field also covers get_sent_requests /
            # get_received_requests, which filter on requester/owner alone.
            {"fields": ["requester", "status"]},
            {"fields": ["owner", "status"]},
            {"fields": ["cancelled_by", "status"]},
            # create_request's active-loan conflict check and
            # analytics_service's per-item finished count.
            {"fields": ["item", "status"]},
        ],
    }
