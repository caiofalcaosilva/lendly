from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ItemCategory(str, Enum):
    TOOLS = "tools"
    ELECTRONICS = "electronics"
    SPORTS = "sports"
    GARDEN = "garden"
    KITCHEN = "kitchen"
    BOOKS = "books"
    TOYS = "toys"
    CLOTHING = "clothing"
    FURNITURE = "furniture"
    OTHER = "other"


class AvailabilityType(str, Enum):
    FREE = "free"
    PAID = "paid"


class ItemCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    category: ItemCategory
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


class ItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    category: Optional[ItemCategory] = None
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


class ItemOwnerResponse(BaseModel):
    id: str
    name: str
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    average_rating: float


class ItemResponse(BaseModel):
    id: str
    owner: ItemOwnerResponse
    title: str
    description: Optional[str] = None
    category: str
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
    created_at: datetime
