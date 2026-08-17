from mongoengine import DateTimeField, Document, IntField, StringField

from app.utils.time import utcnow


class ItemsBannerSlide(Document):
    """One image in the promotional carousel shown on the items/browse
    page — admin-uploaded artwork, optionally linking somewhere. Distinct
    from PlatformSettings.announcement_* (a single text banner shown
    site-wide) and from the static third-party-ad placeholder in the
    frontend (AdSlot, not backed by any data yet)."""

    image_url = StringField(required=True)
    link_url = StringField(max_length=500)
    order = IntField(default=0)
    created_at = DateTimeField(default=utcnow)

    meta = {"collection": "items_banner_slides", "ordering": ["order"]}
