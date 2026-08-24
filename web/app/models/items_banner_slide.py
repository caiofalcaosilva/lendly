from mongoengine import DateTimeField, Document, IntField, StringField

from app.utils.time import utcnow


class ItemsBannerSlide(Document):
    """One slide in the promotional carousel shown at the top of the
    items/browse page — admin-uploaded artwork, optionally linking
    somewhere. Distinct from PlatformSettings.announcement_* (a single
    text banner shown site-wide).

    Two separate images, not one image cropped two ways — the desktop
    banner is a wide/short leaderboard shape (~18:5) and the mobile one
    is a shorter/more compact shape (~2:1); an admin's artwork for one
    rarely composes well simply re-cropped for the other. image_url_mobile
    is optional — a slide created before this existed (or one an admin
    only bothered to upload one version of) just falls back to image_url
    on mobile too, cropped via object-cover."""

    image_url = StringField(required=True)
    image_url_mobile = StringField()
    link_url = StringField(max_length=500)
    order = IntField(default=0)
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {"collection": "items_banner_slides", "ordering": ["order"]}
