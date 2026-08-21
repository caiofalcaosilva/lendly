"""These schemas get dumped wholesale into a MongoEngine `.update(**dict)`
call (update_profile, update_item, update_group) — a field added here
without thinking is a field any authenticated user can set on themself.
This test is the tripwire."""

from app.schemas.group import GroupUpdate
from app.schemas.item import ItemUpdate
from app.schemas.user import UserUpdate

FORBIDDEN_FIELDS = {
    "is_admin",
    "is_verified",
    "is_restricted",
    "is_active",
    "average_rating",
    "rating_count",
    "reliability_score",
    "reliability_count",
    "password_hash",
    "totp_secret",
    "totp_enabled",
    "identity_status",
    "restricted_reason",
    "restricted_at",
}


def test_user_update_excludes_sensitive_fields():
    assert FORBIDDEN_FIELDS.isdisjoint(UserUpdate.model_fields)


def test_item_update_excludes_sensitive_fields():
    assert FORBIDDEN_FIELDS.isdisjoint(ItemUpdate.model_fields)


def test_group_update_excludes_sensitive_fields():
    assert FORBIDDEN_FIELDS.isdisjoint(GroupUpdate.model_fields)
