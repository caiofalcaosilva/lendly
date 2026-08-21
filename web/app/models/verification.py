from mongoengine import DateTimeField, Document, ReferenceField, StringField

from app.utils.time import utcnow

VERIFICATION_STATUSES = ["pending", "approved", "rejected"]


class VerificationSubmission(Document):
    user = ReferenceField("User", required=True)
    # Encrypted at rest (app/utils/crypto.py) — same PII as User.cpf. Never
    # queried by value (always reached via .user/.id), so no hash needed.
    cpf = StringField(required=True)
    # Filesystem paths, not public URLs — served only via an admin endpoint.
    selfie_path = StringField(required=True)
    document_path = StringField(required=True)
    status = StringField(default="pending", choices=VERIFICATION_STATUSES)
    rejection_reason = StringField(max_length=500)
    reviewed_by = ReferenceField("User")
    reviewed_at = DateTimeField()
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "verification_submissions",
        "indexes": ["user", "status"],
    }
