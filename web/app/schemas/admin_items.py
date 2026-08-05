from datetime import datetime

from pydantic import BaseModel


class AdminItemSummary(BaseModel):
    id: str
    title: str
    category: str
    subcategory: str | None = None
    owner_id: str
    owner_name: str
    owner_email: str
    city: str | None = None
    neighborhood: str | None = None
    availability_type: str
    daily_rate: float | None = None
    is_active: bool
    is_available: bool
    is_public: bool
    created_at: datetime
