from datetime import datetime

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    id: str
    request_id: str
    sender_id: str
    sender_name: str
    text: str
    created_at: datetime
