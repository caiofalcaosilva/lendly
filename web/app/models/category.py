from datetime import datetime

from mongoengine import BooleanField, DateTimeField, Document, EmbeddedDocument, EmbeddedDocumentField, ListField, StringField


class Subcategory(EmbeddedDocument):
    key = StringField(required=True, max_length=50)
    label = StringField(required=True, max_length=100)
    is_active = BooleanField(default=True)


class Category(Document):
    """Editable via /admin/categories — replaces the old hardcoded
    ItemCategory enum + SUBCATEGORIES dict. Deactivating a category or
    subcategory only hides it from new item creation (see category_service);
    existing items keep referencing the same key, so nothing needs
    migrating when one gets deactivated."""

    key = StringField(required=True, unique=True, max_length=50)
    label = StringField(required=True, max_length=100)
    is_active = BooleanField(default=True)
    subcategories = ListField(EmbeddedDocumentField(Subcategory), default=list)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {"collection": "categories"}
