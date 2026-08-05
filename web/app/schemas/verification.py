from datetime import datetime

from pydantic import BaseModel, Field


class VerificationRejectRequest(BaseModel):
    reason: str | None = Field(None, max_length=500)


class VerificationResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    cpf: str
    status: str
    rejection_reason: str | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class VerificationStatusResponse(BaseModel):
    identity_status: str
    rejection_reason: str | None = None
