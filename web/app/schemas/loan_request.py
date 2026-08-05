from datetime import datetime
from enum import Enum

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
    notes: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def check_dates(self) -> "LoanRequestCreate":
        if self.pickup_date >= self.expected_return_date:
            raise ValueError("expected_return_date must be after pickup_date")
        return self


class LoanRequestExtend(BaseModel):
    new_expected_return_date: datetime


class LoanRequestResponse(BaseModel):
    id: str
    item_id: str
    item_title: str
    requester_id: str
    requester_name: str
    requester_phone: str | None = None
    owner_id: str
    owner_name: str
    owner_phone: str | None = None
    status: str
    payment_status: str
    pickup_date: datetime
    expected_return_date: datetime
    actual_return_date: datetime | None = None
    notes: str | None = None
    requested_extension_date: datetime | None = None
    extension_status: str = "none"
    pickup_confirmed_by_owner_at: datetime | None = None
    pickup_confirmed_by_requester_at: datetime | None = None
    pickup_forced: bool = False
    return_confirmed_by_owner_at: datetime | None = None
    return_confirmed_by_requester_at: datetime | None = None
    return_forced: bool = False
    created_at: datetime
    updated_at: datetime
