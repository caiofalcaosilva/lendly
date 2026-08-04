from datetime import datetime

from mongoengine import DateTimeField, Document, ListField, ReferenceField, StringField


class Group(Document):
    name = StringField(required=True, max_length=100)
    description = StringField(max_length=500)
    invite_code = StringField(required=True, unique=True)
    created_by = ReferenceField("User", required=True)
    members = ListField(ReferenceField("User"), default=list)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "groups",
        "indexes": [
            "members",
            "created_by",
            {"fields": ["invite_code"], "unique": True},
        ],
    }
