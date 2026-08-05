from mongoengine import DateTimeField, Document, ReferenceField, StringField

from app.utils.time import utcnow


class Message(Document):
    request = ReferenceField("LoanRequest", required=True)
    sender = ReferenceField("User", required=True)
    text = StringField(required=True, max_length=2000)
    created_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "messages",
        "indexes": [
            {"fields": ["request", "created_at"]},
            # export_service's per-user data export (LGPD request).
            "sender",
        ],
    }
