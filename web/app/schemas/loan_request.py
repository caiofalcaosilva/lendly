from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class RequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REFUSED = "refused"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"
    CANCELLED = "cancelled"


class LoanRequestCreate(BaseModel):
    item_id: str
    pickup_date: datetime
    expected_return_date: datetime
    notes: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def check_dates(self) -> "LoanRequestCreate":
        if self.pickup_date >= self.expected_return_date:
            raise ValueError("expected_return_date must be after pickup_date")
        return self


class LoanRequestResponse(BaseModel):
    id: str
    item_id: str
    item_title: str
    requester_id: str
    requester_name: str
    owner_id: str
    owner_name: str
    status: str
    pickup_date: datetime
    expected_return_date: datetime
    actual_return_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
