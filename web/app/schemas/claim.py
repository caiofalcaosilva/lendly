from datetime import datetime

from pydantic import BaseModel, Field


class ClaimCreate(BaseModel):
    description: str = Field(..., min_length=10, max_length=1000)
    requested_amount: float = Field(..., gt=0)


class ClaimResponse(BaseModel):
    id: str
    loan_request_id: str
    item_id: str
    item_title: str
    # Whether this claim can ever reach "advanced_by_lendly" — that
    # fallback only exists for paid items (see claim_service docstring on
    # why free items have no Lendly-funded safety net). Lets the admin UI
    # show/hide the "confirmar adiantamento" action without a second call.
    item_availability_type: str
    owner_id: str
    owner_name: str
    requester_id: str
    requester_name: str
    description: str
    requested_amount: float
    # The item's declared_value at read time — the payout ceiling, shown
    # alongside requested/approved_amount so admin can review at a glance.
    declared_value: float
    photos: list[str]
    status: str
    approved_amount: float | None = None
    rejection_reason: str | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    paid_at: datetime | None = None
    advanced_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    created_at: datetime


class ClaimApprove(BaseModel):
    approved_amount: float = Field(..., gt=0)


class ClaimReject(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class ClaimCancel(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class FundSummaryResponse(BaseModel):
    collected: float
    paid_out: float
    balance: float
