from datetime import datetime

from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    EmailField,
    FloatField,
    IntField,
    ListField,
    StringField,
)


class User(Document):
    name = StringField(required=True, max_length=100)
    email = EmailField(required=True, unique=True)
    phone = StringField(max_length=20)
    # address
    zip_code = StringField(max_length=10)
    latitude = FloatField()
    longitude = FloatField()
    street = StringField(max_length=200)
    number = StringField(max_length=20)
    complement = StringField(max_length=100)
    neighborhood = StringField(max_length=100)
    city = StringField(max_length=100)
    state = StringField(max_length=2)
    password_hash = StringField(required=True)
    is_active = BooleanField(default=True)
    # Email verification
    is_verified = BooleanField(default=False)
    email_verification_token = StringField()
    email_verification_expires = DateTimeField()
    # 2FA (TOTP)
    totp_secret = StringField()
    totp_enabled = BooleanField(default=False)
    # Trusted devices (list of device UUIDs)
    trusted_devices = ListField(StringField(), default=list)
    average_rating = FloatField(default=0.0)
    rating_count = IntField(default=0)
    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "users",
        "strict": False,
        "indexes": [
            {"fields": ["email"], "unique": True},
            "city",
            "state",
            "neighborhood",
        ],
    }
