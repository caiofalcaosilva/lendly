from mongoengine import DateTimeField, Document, IntField, ReferenceField, StringField

from app.utils.time import utcnow


class Review(Document):
    loan_request = ReferenceField("LoanRequest", required=True)
    reviewer = ReferenceField("User", required=True)
    reviewed = ReferenceField("User", required=True)
    rating = IntField(required=True, min_value=1, max_value=5)
    comment = StringField(max_length=500)
    created_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "reviews",
        "indexes": [
            "reviewer",
            "reviewed",
            # Was two separate single-field indexes (reviewer, loan_request)
            # backing review_service.create_review's duplicate check — that
            # check was app-level only (query-then-insert), so two
            # near-simultaneous requests could both pass it and create two
            # reviews for the same pair. A unique compound index turns that
            # into an actual DB-level guarantee; create_review now catches
            # the resulting NotUniqueError.
            {"fields": ["loan_request", "reviewer"], "unique": True},
        ],
    }
