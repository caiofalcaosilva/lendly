from datetime import datetime

from mongoengine import DateTimeField, Document, IntField, ReferenceField, StringField


class Review(Document):
    loan_request = ReferenceField("LoanRequest", required=True)
    reviewer = ReferenceField("User", required=True)
    reviewed = ReferenceField("User", required=True)
    rating = IntField(required=True, min_value=1, max_value=5)
    comment = StringField(max_length=500)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "reviews",
        "indexes": ["reviewer", "reviewed", "loan_request"],
    }
