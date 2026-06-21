from datetime import datetime

from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    FloatField,
    ListField,
    ReferenceField,
    StringField,
)


class Item(Document):
    owner = ReferenceField("User", required=True)
    title = StringField(required=True, max_length=100)
    description = StringField(max_length=1000)
    category = StringField(required=True)
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
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "items",
        "indexes": [
            "owner",
            "category",
            "city",
            "neighborhood",
            "availability_type",
            "is_available",
            "is_active",
            "state",
        ],
    }
