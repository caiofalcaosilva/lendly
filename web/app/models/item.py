from datetime import datetime

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
    # Recurring weekly restriction: which weekdays the item can be picked up
    # or returned on (datetime.weekday(): 0=segunda ... 6=domingo). Empty
    # list = no restriction, available every day (default/legacy behavior).
    available_days = ListField(IntField(min_value=0, max_value=6), default=list)
    # Owner opt-in: only requesters with User.identity_status == "approved"
    # can request this item. See loan_request_service.create_request.
    requires_identity_verification = BooleanField(default=False)
    is_active = BooleanField(default=True)
    # Who last flipped is_active via /admin/items and when — feeds the admin
    # action history (see admin_action_service). Left unset when the OWNER
    # deletes their own item (item_service.delete_item), only populated by
    # an admin's activate/deactivate action.
    status_changed_by = ReferenceField("User")
    status_changed_at = DateTimeField()
    groups = ListField(ReferenceField("Group"), default=list)
    is_public = BooleanField(default=True)
    # Users waiting to be notified when this item becomes available again
    # (is_available flips back to True). Cleared after notifying — a
    # one-shot alert, not a standing subscription.
    waitlist = ListField(ReferenceField("User"), default=list)
    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "items",
        "indexes": [
            "owner",
            "category",
            "subcategory",
            "city",
            "neighborhood",
            "availability_type",
            "is_available",
            "is_active",
            "state",
            "groups",
            "is_public",
            # Full-text search over title + description (see item_service.list_items).
            {"fields": ["$title", "$description"], "default_language": "portuguese"},
        ],
    }
