from datetime import datetime

from pydantic import BaseModel


class AdminUserSummary(BaseModel):
    id: str
    name: str
    email: str
    account_type: str
    trade_name: str | None = None
    city: str | None = None
    neighborhood: str | None = None
    is_active: bool
    is_admin: bool
    is_verified: bool
    identity_status: str
    average_rating: float
    rating_count: int
    finished_loans_count: int
    created_at: datetime
