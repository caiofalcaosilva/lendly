from mongoengine import DateTimeField, Document, ListField, ReferenceField, StringField

from app.utils.time import utcnow


class Group(Document):
    name = StringField(required=True, max_length=100)
    description = StringField(max_length=500)
    invite_code = StringField(required=True, unique=True)
    created_by = ReferenceField("User", required=True)
    members = ListField(ReferenceField("User"), default=list)
    created_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "groups",
        # created_by used to be indexed here too, but it's only ever read
        # off an already-fetched group (str(group.created_by.id) == ...),
        # never used to filter a query — dropped as dead weight.
        "indexes": [
            "members",
            {"fields": ["invite_code"], "unique": True},
        ],
    }
