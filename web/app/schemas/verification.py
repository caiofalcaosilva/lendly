from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class VerificationRejectRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


class VerificationResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    cpf: str
    status: str
    rejection_reason: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime


class VerificationStatusResponse(BaseModel):
    identity_status: str
    rejection_reason: Optional[str] = None
