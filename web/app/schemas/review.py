from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=500)


class ReviewResponse(BaseModel):
    id: str
    loan_request_id: str
    item_id: str
    item_title: str
    reviewer_id: str
    reviewer_name: str
    reviewed_id: str
    reviewed_name: str
    # role of the person being reviewed: 'owner' = lent the item, 'requester' = borrowed it
    reviewed_role: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime
