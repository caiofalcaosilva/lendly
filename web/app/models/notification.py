from mongoengine import DateTimeField, Document, ReferenceField, StringField

from app.utils.time import utcnow

# Mirrors the 5 toggleable categories in User.notification_prefs (email)
# and User.inapp_notification_prefs — kept as separate lists on purpose
# rather than importing one from the other, since a Document's choices=
# and an EmbeddedDocument's field set are different concerns.
NOTIFICATION_TYPES = [
    "request_status",
    "new_message",
    "verification_result",
    "item_available",
    "review_reminder",
    # In-app only — no email equivalent (see
    # app.utils.notifications._INAPP_ONLY_CATEGORIES).
    "group_vouch",
    "favorite_item_changed",
    "group_new_item",
    "group_membership_changed",
    # Security — not toggleable at all (see
    # app.utils.notifications._SECURITY_CATEGORIES), mirrors send_new_login_email.
    "new_login",
]


class Notification(Document):
    recipient = ReferenceField("User", required=True)
    type = StringField(required=True, choices=NOTIFICATION_TYPES)
    title = StringField(required=True, max_length=200)
    body = StringField(max_length=500)
    # Relative frontend path the notification links to, e.g. "/requests/{id}".
    link = StringField(max_length=200)
    read_at = DateTimeField()
    created_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "notifications",
        "indexes": [
            {"fields": ["recipient", "-created_at"]},
            {"fields": ["recipient", "read_at"]},
        ],
    }
