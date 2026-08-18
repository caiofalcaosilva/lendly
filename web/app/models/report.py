from mongoengine import (
    DateTimeField,
    Document,
    ReferenceField,
    StringField,
    ValidationError,
)

from app.utils.time import utcnow

REPORT_REASONS = ["spam", "fake_item", "inappropriate", "fraud", "other"]
REPORT_STATUSES = ["pending", "dismissed", "actioned"]


class Report(Document):
    reporter = ReferenceField("User", required=True)
    # Exactly one of these three is set, based on the report's target.
    item = ReferenceField("Item")
    reported_user = ReferenceField("User")
    reported_group = ReferenceField("Group")
    reason = StringField(required=True, choices=REPORT_REASONS)
    description = StringField(max_length=500)
    status = StringField(default="pending", choices=REPORT_STATUSES)
    reviewed_by = ReferenceField("User")
    reviewed_at = DateTimeField()
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "reports",
        "indexes": [
            "reporter",
            "item",
            "reported_user",
            "reported_group",
            "status",
            # Admin action history, queried with a $ne: None filter.
            "reviewed_by",
        ],
    }

    def clean(self) -> None:
        targets = [self.item, self.reported_user, self.reported_group]
        if sum(1 for t in targets if t is not None) != 1:
            raise ValidationError(
                "Exactly one of item/reported_user/reported_group must be set"
            )
