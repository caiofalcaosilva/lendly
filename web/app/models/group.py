from mongoengine import (
    DateTimeField,
    Document,
    EmbeddedDocument,
    EmbeddedDocumentField,
    ListField,
    ReferenceField,
    StringField,
)

from app.utils.time import utcnow


class Vouch(EmbeddedDocument):
    """One member confirming they personally know another, within a single
    group — a light "vouching" signal, deliberately scoped to people who
    already share an invite-only group rather than a public reputation
    system open to anyone."""

    voucher = ReferenceField("User", required=True)
    vouched_for = ReferenceField("User", required=True)
    created_at = DateTimeField(default=utcnow)


class Group(Document):
    name = StringField(required=True, max_length=100)
    description = StringField(max_length=500)
    invite_code = StringField(required=True, unique=True)
    created_by = ReferenceField("User", required=True)
    members = ListField(ReferenceField("User"), default=list)
    # Trusted deputies the creator appoints — can edit the group and remove
    # regular members, but only the creator can appoint/revoke a moderator
    # or remove one, so two moderators can't strip each other out.
    moderators = ListField(ReferenceField("User"), default=list)
    vouches = ListField(EmbeddedDocumentField(Vouch), default=list)
    created_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "groups",
        "indexes": ["members", {"fields": ["invite_code"], "unique": True}],
    }
