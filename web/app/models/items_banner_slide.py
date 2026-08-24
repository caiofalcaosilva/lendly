from mongoengine import DateTimeField, Document, IntField, StringField

from app.utils.time import utcnow


class ItemsBannerSlide(Document):
    """One image in the promotional carousel shown at the top of the
    items/browse page — admin-uploaded artwork, optionally linking
    somewhere. Distinct from PlatformSettings.announcement_* (a single
    text banner shown site-wide)."""

    image_url = StringField(required=True)
    link_url = StringField(max_length=500)
    order = IntField(default=0)
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {"collection": "items_banner_slides", "ordering": ["order"]}
