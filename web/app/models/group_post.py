from mongoengine import DateTimeField, Document, ReferenceField, StringField

from app.utils.time import utcnow


class GroupPost(Document):
    """One entry on a group's mural — a lightweight text announcement board
    ("reunião sábado", "alguém tem parafusadeira?"), not a chat: no threads,
    no read state, no editing. Any member can post; the author or the
    group's creator/moderator can remove one."""

    group = ReferenceField("Group", required=True)
    author = ReferenceField("User", required=True)
    body = StringField(required=True, max_length=1000)
    created_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "group_posts",
        "indexes": [{"fields": ["group", "-id"]}],
    }
