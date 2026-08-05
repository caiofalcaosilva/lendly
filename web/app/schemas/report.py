from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class ReportCreate(BaseModel):
    item_id: str | None = None
    reported_user_id: str | None = None
    reason: str = Field(..., pattern="^(spam|fake_item|inappropriate|fraud|other)$")
    description: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def _exactly_one_target(self):
        if bool(self.item_id) == bool(self.reported_user_id):
            raise ValueError("Provide exactly one of item_id or reported_user_id")
        return self


class ReportResponse(BaseModel):
    id: str
    reporter_id: str
    reporter_name: str
    item_id: str | None = None
    item_title: str | None = None
    reported_user_id: str | None = None
    reported_user_name: str | None = None
    reason: str
    description: str | None = None
    status: str
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
