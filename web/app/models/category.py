from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    EmbeddedDocument,
    EmbeddedDocumentField,
    ListField,
    StringField,
)

from app.utils.time import utcnow


class Subcategory(EmbeddedDocument):
    key = StringField(required=True, max_length=50)
    label = StringField(required=True, max_length=100)
    is_active = BooleanField(default=True)


class Category(Document):
    """Deactivating only hides a category/subcategory from new item
    creation — existing items keep referencing the same key."""

    key = StringField(required=True, unique=True, max_length=50)
    label = StringField(required=True, max_length=100)
    is_active = BooleanField(default=True)
    subcategories = ListField(EmbeddedDocumentField(Subcategory), default=list)
    created_at = DateTimeField(default=utcnow)

    meta = {"collection": "categories", "indexes": ["is_active"]}
