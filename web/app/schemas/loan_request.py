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


class FulfillmentMethod(str, Enum):
    PICKUP = "pickup"
    DELIVERY = "delivery"


class LoanRequestCreate(BaseModel):
    item_id: str
    pickup_date: datetime
    expected_return_date: datetime
    quantity: int = Field(default=1, ge=1)
    notes: str | None = Field(None, max_length=500)
    # Only required when the item allows more than one fulfillment option —
    # resolved against the item's fulfillment_options server-side, see
    # loan_request_service.lifecycle.create_request.
    fulfillment_method: FulfillmentMethod | None = None

    @model_validator(mode="after")
    def check_dates(self) -> "LoanRequestCreate":
        if self.pickup_date >= self.expected_return_date:
            raise ValueError("expected_return_date must be after pickup_date")
        return self


class LoanRequestExtend(BaseModel):
    new_expected_return_date: datetime


class LoanRequestConfirmCode(BaseModel):
    code: str = Field(..., min_length=1, max_length=6)


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
    quantity: int = 1
    notes: str | None = None
    requested_extension_date: datetime | None = None
    extension_status: str = "none"
    # True while a paid extension charge exists and hasn't been confirmed
    # yet — tells the requester's UI when to show the extension checkout.
    has_pending_extension_payment: bool = False
    fulfillment_method: str = "pickup"
    # Only ever populated for the requester — see _common.to_response.
    delivery_confirmation_code: str | None = None
    delivery_confirmation_code_attempts: int = 0
    delivery_confirmation_code_max_attempts: int = 0
    pickup_confirmed_by_owner_at: datetime | None = None
    pickup_confirmed_by_requester_at: datetime | None = None
    pickup_forced: bool = False
    return_confirmed_by_owner_at: datetime | None = None
    return_confirmed_by_requester_at: datetime | None = None
    return_forced: bool = False
    created_at: datetime
    updated_at: datetime
