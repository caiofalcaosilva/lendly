from datetime import datetime

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(None, max_length=500)


class ReviewResponse(BaseModel):
    id: str
    loan_request_id: str
    item_id: str
    item_title: str
    reviewer_id: str
    reviewer_name: str
    reviewed_id: str
    reviewed_name: str
    # role of the person being reviewed: 'owner' = lent the item, 'requester' = borrowed
    reviewed_role: str
    rating: int
    comment: str | None = None
    created_at: datetime
