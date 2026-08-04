from datetime import datetime

from mongoengine import DateTimeField, Document, ReferenceField, StringField

REPORT_REASONS = ["spam", "fake_item", "inappropriate", "fraud", "other"]
REPORT_STATUSES = ["pending", "dismissed", "actioned"]


class Report(Document):
    reporter = ReferenceField("User", required=True)
    # Exactly one of these two is set, based on the report's target.
    item = ReferenceField("Item")
    reported_user = ReferenceField("User")
    reason = StringField(required=True, choices=REPORT_REASONS)
    description = StringField(max_length=500)
    status = StringField(default="pending", choices=REPORT_STATUSES)
    reviewed_by = ReferenceField("User")
    reviewed_at = DateTimeField()
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "reports",
        "indexes": ["reporter", "item", "reported_user", "status"],
    }
