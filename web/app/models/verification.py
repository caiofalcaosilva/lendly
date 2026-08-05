from mongoengine import DateTimeField, Document, ReferenceField, StringField

from app.utils.time import utcnow

VERIFICATION_STATUSES = ["pending", "approved", "rejected"]


class VerificationSubmission(Document):
    user = ReferenceField("User", required=True)
    cpf = StringField(required=True, max_length=14)
    # Filesystem paths, not public URLs — served only via an admin endpoint.
    selfie_path = StringField(required=True)
    document_path = StringField(required=True)
    status = StringField(default="pending", choices=VERIFICATION_STATUSES)
    rejection_reason = StringField(max_length=500)
    reviewed_by = ReferenceField("User")
    reviewed_at = DateTimeField()
    created_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "verification_submissions",
        "indexes": ["user", "status"],
    }
