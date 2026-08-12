from datetime import datetime

from pydantic import BaseModel, Field


class GroupPostCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=1000)


class GroupPostAuthor(BaseModel):
    id: str
    name: str


class GroupPostResponse(BaseModel):
    id: str
    group_id: str
    author: GroupPostAuthor
    body: str
    created_at: datetime
