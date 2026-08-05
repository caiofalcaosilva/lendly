from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class AvailabilityType(str, Enum):
    FREE = "free"
    PAID = "paid"


def _validate_available_days(value: list[int]) -> list[int]:
    if any(d < 0 or d > 6 for d in value):
        raise ValueError(
            "available_days values must be between 0 (segunda) and 6 (domingo)"
        )
    if len(set(value)) != len(value):
        raise ValueError("available_days must not contain duplicates")
    return sorted(value)


class ItemCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str | None = Field(None, max_length=1000)
    # Validated against the DB-backed category list (see category_service),
    # not a fixed enum — admins can add/deactivate categories without a
    # deploy, so the valid set can change at runtime.
    category: str = Field(..., min_length=1, max_length=50)
    subcategory: str | None = None
    photos: list[str] | None = []
    availability_type: AvailabilityType
    daily_rate: float | None = Field(None, ge=0)
    usage_rules: str | None = Field(None, max_length=500)
    zip_code: str | None = Field(None, max_length=10)
    neighborhood: str | None = Field(None, max_length=100)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=2)
    latitude: float | None = None
    longitude: float | None = None
    group_ids: list[str] = []
    is_public: bool = True
    available_days: list[int] = Field(
        default=[], description="0=segunda...6=domingo; vazio = todo dia"
    )
    requires_identity_verification: bool = False

    _check_available_days = field_validator("available_days")(_validate_available_days)


class ItemUpdate(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=100)
    description: str | None = Field(None, max_length=1000)
    category: str | None = Field(None, min_length=1, max_length=50)
    subcategory: str | None = None
    photos: list[str] | None = None
    availability_type: AvailabilityType | None = None
    daily_rate: float | None = Field(None, ge=0)
    usage_rules: str | None = Field(None, max_length=500)
    zip_code: str | None = Field(None, max_length=10)
    neighborhood: str | None = Field(None, max_length=100)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=2)
    latitude: float | None = None
    longitude: float | None = None
    is_available: bool | None = None
    group_ids: list[str] | None = None
    is_public: bool | None = None
    available_days: list[int] | None = None
    requires_identity_verification: bool | None = None

    _check_available_days = field_validator("available_days")(
        lambda v: v if v is None else _validate_available_days(v)
    )


class ItemOwnerResponse(BaseModel):
    id: str
    name: str
    neighborhood: str | None = None
    city: str | None = None
    average_rating: float
    reliability_score: float | None = None
    reliability_count: int = 0
    account_type: str = "individual"
    trade_name: str | None = None


class ItemResponse(BaseModel):
    id: str
    owner: ItemOwnerResponse
    title: str
    description: str | None = None
    category: str
    subcategory: str | None = None
    photos: list[str]
    availability_type: str
    daily_rate: float | None = None
    usage_rules: str | None = None
    zip_code: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_available: bool
    is_active: bool
    is_favorited: bool = False
    is_waitlisted: bool = False
    is_public: bool = True
    groups: list[str] = []
    available_days: list[int] = []
    requires_identity_verification: bool = False
    created_at: datetime
