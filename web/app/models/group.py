from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    EmbeddedDocument,
    EmbeddedDocumentField,
    FloatField,
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
    # Small optional context ("vizinho de prédio", "colega de trabalho") —
    # set once at vouch time, not editable by re-vouching (see
    # group_service.vouch_for_member).
    note = StringField(max_length=200)
    created_at = DateTimeField(default=utcnow)


class Group(Document):
    name = StringField(required=True, max_length=100)
    description = StringField(max_length=500)
    photo_url = StringField(max_length=300)
    invite_code = StringField(required=True, unique=True)
    created_by = ReferenceField("User", required=True)
    members = ListField(ReferenceField("User"), default=list)
    # Trusted deputies the creator appoints — can edit the group and remove
    # regular members, but only the creator can appoint/revoke a moderator
    # or remove one, so two moderators can't strip each other out.
    moderators = ListField(ReferenceField("User"), default=list)
    vouches = ListField(EmbeddedDocumentField(Vouch), default=list)
    # Denormalized from the creator's address at creation time (same idea as
    # Item.latitude/longitude) — lets "grupos perto de você" reuse the same
    # haversine-in-Python approach as the neighborhood item feed, with no
    # geospatial index. Opt-in: a group only shows up there once its
    # creator/moderator flips is_discoverable, so private groups stay private.
    is_discoverable = BooleanField(default=False)
    neighborhood = StringField(max_length=100)
    city = StringField(max_length=100)
    state = StringField(max_length=2)
    latitude = FloatField()
    longitude = FloatField()
    created_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "groups",
        "indexes": [
            "members",
            {"fields": ["invite_code"], "unique": True},
            "is_discoverable",
        ],
    }
