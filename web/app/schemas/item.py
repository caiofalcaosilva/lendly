from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class AvailabilityType(str, Enum):
    FREE = "free"
    PAID = "paid"


def _validate_available_days(value: List[int]) -> List[int]:
    if any(d < 0 or d > 6 for d in value):
        raise ValueError("available_days values must be between 0 (segunda) and 6 (domingo)")
    if len(set(value)) != len(value):
        raise ValueError("available_days must not contain duplicates")
    return sorted(value)


class ItemCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    # Validated against the DB-backed category list (see category_service),
    # not a fixed enum — admins can add/deactivate categories without a
    # deploy, so the valid set can change at runtime.
    category: str = Field(..., min_length=1, max_length=50)
    subcategory: Optional[str] = None
    photos: Optional[List[str]] = []
    availability_type: AvailabilityType
    daily_rate: Optional[float] = Field(None, ge=0)
    usage_rules: Optional[str] = Field(None, max_length=500)
    zip_code: Optional[str] = Field(None, max_length=10)
    neighborhood: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=2)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    group_ids: List[str] = []
    is_public: bool = True
    available_days: List[int] = Field(default=[], description="0=segunda...6=domingo; vazio = todo dia")
    requires_identity_verification: bool = False

    _check_available_days = field_validator("available_days")(_validate_available_days)


class ItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    subcategory: Optional[str] = None
    photos: Optional[List[str]] = None
    availability_type: Optional[AvailabilityType] = None
    daily_rate: Optional[float] = Field(None, ge=0)
    usage_rules: Optional[str] = Field(None, max_length=500)
    zip_code: Optional[str] = Field(None, max_length=10)
    neighborhood: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=2)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_available: Optional[bool] = None
    group_ids: Optional[List[str]] = None
    is_public: Optional[bool] = None
    available_days: Optional[List[int]] = None
    requires_identity_verification: Optional[bool] = None

    _check_available_days = field_validator("available_days")(
        lambda v: v if v is None else _validate_available_days(v)
    )


class ItemOwnerResponse(BaseModel):
    id: str
    name: str
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    average_rating: float
    reliability_score: Optional[float] = None
    reliability_count: int = 0
    account_type: str = "individual"
    trade_name: Optional[str] = None


class ItemResponse(BaseModel):
    id: str
    owner: ItemOwnerResponse
    title: str
    description: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    photos: List[str]
    availability_type: str
    daily_rate: Optional[float] = None
    usage_rules: Optional[str] = None
    zip_code: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_available: bool
    is_active: bool
    is_favorited: bool = False
    is_waitlisted: bool = False
    is_public: bool = True
    groups: List[str] = []
    available_days: List[int] = []
    requires_identity_verification: bool = False
    created_at: datetime
