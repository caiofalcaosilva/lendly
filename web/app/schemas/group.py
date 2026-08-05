from datetime import datetime

from pydantic import BaseModel, Field


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = Field(None, max_length=500)


class JoinGroupRequest(BaseModel):
    invite_code: str


class GroupMemberResponse(BaseModel):
    id: str
    name: str
    average_rating: float


class GroupSummary(BaseModel):
    id: str
    name: str
    member_count: int


class GroupResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    invite_code: str
    member_count: int
    members: list[GroupMemberResponse]
    created_by: str
    created_at: datetime
