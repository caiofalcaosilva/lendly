from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class AvailabilityType(str, Enum):
    FREE = "free"
    PAID = "paid"


class FulfillmentOption(str, Enum):
    PICKUP = "pickup"
    DELIVERY = "delivery"


def _validate_available_days(value: list[int]) -> list[int]:
    if any(d < 0 or d > 6 for d in value):
        raise ValueError(
            "available_days values must be between 0 (segunda) and 6 (domingo)"
        )
    if len(set(value)) != len(value):
        raise ValueError("available_days must not contain duplicates")
    return sorted(value)


def _validate_fulfillment_options(
    value: list[FulfillmentOption],
) -> list[FulfillmentOption]:
    if len(set(value)) != len(value):
        raise ValueError("fulfillment_options must not contain duplicates")
    return value


class ItemCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str | None = Field(None, max_length=1000)
    # Validated against category_service's DB-backed list, not a fixed enum.
    category: str = Field(..., min_length=1, max_length=50)
    subcategory: str | None = None
    photos: list[str] | None = []
    availability_type: AvailabilityType
    quantity_total: int = Field(default=1, ge=1)
    daily_rate: float | None = Field(None, ge=0)
    weekly_rate: float | None = Field(None, ge=0)
    monthly_rate: float | None = Field(None, ge=0)
    delivery_fee: float | None = Field(None, ge=0)
    declared_value: float | None = Field(None, ge=0)
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
    fulfillment_options: list[FulfillmentOption] = Field(
        default=[FulfillmentOption.PICKUP], min_length=1
    )

    _check_available_days = field_validator("available_days")(_validate_available_days)
    _check_fulfillment_options = field_validator("fulfillment_options")(
        _validate_fulfillment_options
    )


class ItemUpdate(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=100)
    description: str | None = Field(None, max_length=1000)
    category: str | None = Field(None, min_length=1, max_length=50)
    subcategory: str | None = None
    photos: list[str] | None = None
    availability_type: AvailabilityType | None = None
    quantity_total: int | None = Field(None, ge=1)
    daily_rate: float | None = Field(None, ge=0)
    weekly_rate: float | None = Field(None, ge=0)
    monthly_rate: float | None = Field(None, ge=0)
    delivery_fee: float | None = Field(None, ge=0)
    declared_value: float | None = Field(None, ge=0)
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
    fulfillment_options: list[FulfillmentOption] | None = Field(None, min_length=1)

    _check_available_days = field_validator("available_days")(
        lambda v: v if v is None else _validate_available_days(v)
    )
    _check_fulfillment_options = field_validator("fulfillment_options")(
        lambda v: v if v is None else _validate_fulfillment_options(v)
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


class ItemGroupSummary(BaseModel):
    id: str
    name: str


class ItemResponse(BaseModel):
    id: str
    owner: ItemOwnerResponse
    title: str
    description: str | None = None
    category: str
    subcategory: str | None = None
    photos: list[str]
    availability_type: str
    quantity_total: int = 1
    daily_rate: float | None = None
    weekly_rate: float | None = None
    monthly_rate: float | None = None
    delivery_fee: float | None = None
    # Only ever populated for the owner or an admin — see
    # item_service._common.to_response.
    declared_value: float | None = None
    # Always visible (unlike declared_value itself) — lets the requester's
    # price preview know whether the guarantee fee applies, without leaking
    # the actual replacement value. See payment_service.GUARANTEE_FEE_PERCENT.
    has_declared_value: bool = False
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
    # Same group ids as `groups` above, but with names attached — lets the
    # item page show "shared with X" and link back, without the viewer
    # needing to already be a member to resolve what those ids mean.
    group_summaries: list[ItemGroupSummary] = []
    available_days: list[int] = []
    requires_identity_verification: bool = False
    fulfillment_options: list[str] = ["pickup"]
    created_at: datetime


class ItemAvailabilityResponse(BaseModel):
    available_units: int
    quantity_total: int
