from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    FloatField,
    IntField,
    ListField,
    ReferenceField,
    StringField,
)

from app.utils.time import utcnow


class Item(Document):
    owner = ReferenceField("User", required=True)
    title = StringField(required=True, max_length=100)
    description = StringField(max_length=1000)
    category = StringField(required=True)
    subcategory = StringField()
    photos = ListField(StringField())
    availability_type = StringField(required=True, choices=["free", "paid"])
    daily_rate = FloatField(min_value=0)
    usage_rules = StringField(max_length=500)
    zip_code = StringField(max_length=10)
    neighborhood = StringField(max_length=100)
    city = StringField(max_length=100)
    state = StringField(max_length=2)
    latitude = FloatField()
    longitude = FloatField()
    is_available = BooleanField(default=True)
    # Weekdays open for pickup/return: 0=segunda ... 6=domingo, empty=every day.
    available_days = ListField(IntField(min_value=0, max_value=6), default=list)
    requires_identity_verification = BooleanField(default=False)
    is_active = BooleanField(default=True)
    # True only for items this specific pause cycle deactivated — lets resume
    # restore exactly those, without reactivating something the owner had
    # already deactivated on their own before pausing.
    paused_by_owner = BooleanField(default=False)
    status_changed_by = ReferenceField("User")
    status_changed_at = DateTimeField()
    groups = ListField(ReferenceField("Group"), default=list)
    is_public = BooleanField(default=True)
    # One-shot: cleared after notifying, not a standing subscription.
    waitlist = ListField(ReferenceField("User"), default=list)
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "items",
        "indexes": [
            "owner",
            "category",
            "subcategory",
            "availability_type",
            "groups",
            # Covers list_items' base filter (is_active/is_available/is_public)
            # and its created_at sort in one pass.
            {"fields": ["is_active", "is_available", "is_public", "-created_at"]},
            {"fields": ["$title", "$description"], "default_language": "portuguese"},
        ],
    }
