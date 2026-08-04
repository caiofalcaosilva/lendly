from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class ReportCreate(BaseModel):
    item_id: Optional[str] = None
    reported_user_id: Optional[str] = None
    reason: str = Field(..., pattern="^(spam|fake_item|inappropriate|fraud|other)$")
    description: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def _exactly_one_target(self):
        if bool(self.item_id) == bool(self.reported_user_id):
            raise ValueError("Provide exactly one of item_id or reported_user_id")
        return self


class ReportResponse(BaseModel):
    id: str
    reporter_id: str
    reporter_name: str
    item_id: Optional[str] = None
    item_title: Optional[str] = None
    reported_user_id: Optional[str] = None
    reported_user_name: Optional[str] = None
    reason: str
    description: Optional[str] = None
    status: str
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
