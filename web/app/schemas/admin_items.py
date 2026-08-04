from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AdminItemSummary(BaseModel):
    id: str
    title: str
    category: str
    subcategory: Optional[str] = None
    owner_id: str
    owner_name: str
    owner_email: str
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    availability_type: str
    daily_rate: Optional[float] = None
    is_active: bool
    is_available: bool
    is_public: bool
    created_at: datetime
