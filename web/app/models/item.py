from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    FloatField,
    IntField,
    ListField,
    PointField,
    ReferenceField,
    StringField,
)

from app.models._choices import BRAZIL_STATES
from app.utils.time import utcnow


class Item(Document):
    owner = ReferenceField("User", required=True)
    title = StringField(required=True, max_length=100)
    description = StringField(max_length=1000)
    category = StringField(required=True)
    subcategory = StringField()
    photos = ListField(StringField())
    availability_type = StringField(required=True, choices=["free", "paid"])
    # Money fields are stored as integer cents (not reais-as-float) so
    # price-tier/fee math never carries binary-float rounding noise — see
    # app.utils.money. The API still speaks reais as float; that
    # conversion happens only where these fields are read/written.
    daily_rate_cents = IntField(min_value=0)
    # Optional discounted tiers — see payment_service._calculate_price for how
    # these combine with daily_rate_cents. Unset means "behave exactly like
    # before tiered pricing existed": daily_rate_cents * days, no tiers involved.
    weekly_rate_cents = IntField(min_value=0)
    monthly_rate_cents = IntField(min_value=0)
    usage_rules = StringField(max_length=500)
    zip_code = StringField(max_length=10)
    neighborhood = StringField(max_length=100)
    city = StringField(max_length=100)
    state = StringField(max_length=2, choices=BRAZIL_STATES)
    latitude = FloatField()
    longitude = FloatField()
    # GeoJSON mirror of latitude/longitude, kept in sync on every write (see
    # app.utils.geo.to_point) — latitude/longitude stay the source of truth
    # read everywhere else (schemas, frontend maps); this field exists only
    # so list_items' radius search can use a real $geoWithin/2dsphere index
    # instead of Haversine-in-Python over the whole collection.
    location = PointField()
    is_available = BooleanField(default=True)
    # How many identical units this item represents (e.g. a "kit" the owner
    # has hundreds of). Independent of is_available — that's still the
    # owner's manual pause switch, this is a separate stock dimension. Items
    # created before this field existed load with quantity_total=1, exactly
    # matching how they already behaved as a single-unit item.
    quantity_total = IntField(min_value=1, default=1)
    # Weekdays open for pickup/return: 0=segunda ... 6=domingo, empty=every day.
    available_days = ListField(IntField(min_value=0, max_value=6), default=list)
    # Which handoff method(s) the owner accepts for this item. Items created
    # before this field existed load with the default below (MongoEngine
    # fills in field defaults for keys missing from the stored document) —
    # no backfill needed.
    fulfillment_options = ListField(
        StringField(choices=["pickup", "delivery"]), default=lambda: ["pickup"]
    )
    # Flat fee added on top of the rental price when a request picks
    # "delivery" — folded straight into gross_amount at charge time (see
    # payment_service.create_payment_for_request), so it's taxed by the same
    # platform fee % as everything else and refunded automatically along
    # with the rest on a pre-pickup cancellation. Only takes effect on paid
    # items — inert on free ones, same as daily_rate_cents already is.
    delivery_fee_cents = IntField(min_value=0)
    # Replacement value, set by the owner — never shown on the public item
    # page (see item_service._common.to_response), only to the owner and
    # admins. Independent of availability_type: a free item still has real
    # value if it's lost or damaged. Currently just a record; will become
    # the guarantee payout ceiling once that feature exists.
    declared_value_cents = IntField(min_value=0)
    requires_identity_verification = BooleanField(default=False)
    is_active = BooleanField(default=True)
    # True only for items this specific pause cycle deactivated — lets resume
    # restore exactly those, without reactivating something the owner had
    # already deactivated on their own before pausing.
    paused_by_owner = BooleanField(default=False)
    status_changed_by = ReferenceField("User")
    status_changed_at = DateTimeField()
    groups = ListField(ReferenceField("Group"), default=list)
    is_public = BooleanField(default=True)
    # One-shot: cleared after notifying, not a standing subscription.
    waitlist = ListField(ReferenceField("User"), default=list)
    created_at = DateTimeField(default=utcnow)
    updated_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "items",
        "indexes": [
            "owner",
            "category",
            "subcategory",
            "availability_type",
            "groups",
            # Covers list_items' base filter (is_active/is_available/is_public)
            # and its created_at sort in one pass.
            {"fields": ["is_active", "is_available", "is_public", "-created_at"]},
            {"fields": ["$title", "$description"], "default_language": "portuguese"},
        ],
    }
