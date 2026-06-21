from datetime import datetime

from mongoengine import DateTimeField, Document, ReferenceField, StringField

REQUEST_STATUSES = ["pending", "accepted", "refused", "in_progress", "finished", "cancelled"]


class LoanRequest(Document):
    item = ReferenceField("Item", required=True)
    requester = ReferenceField("User", required=True)
    owner = ReferenceField("User", required=True)
    status = StringField(default="pending", choices=REQUEST_STATUSES)
    pickup_date = DateTimeField(required=True)
    expected_return_date = DateTimeField(required=True)
    actual_return_date = DateTimeField()
    notes = StringField(max_length=500)
    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "loan_requests",
        "indexes": ["requester", "owner", "item", "status"],
    }
