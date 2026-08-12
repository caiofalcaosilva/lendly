from datetime import datetime

from pydantic import BaseModel, Field


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = Field(None, max_length=500)


class GroupUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = Field(None, max_length=500)
    is_discoverable: bool | None = None


class JoinGroupRequest(BaseModel):
    invite_code: str


class GroupMemberResponse(BaseModel):
    id: str
    name: str
    average_rating: float
    vouch_count: int = 0
    vouched_by_me: bool = False
    is_moderator: bool = False


class GroupSummary(BaseModel):
    id: str
    name: str
    member_count: int
    photo_url: str | None = None


class GroupResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    photo_url: str | None = None
    invite_code: str
    is_discoverable: bool = False
    neighborhood: str | None = None
    city: str | None = None
    member_count: int
    members: list[GroupMemberResponse]
    created_by: str
    created_at: datetime


class NearbyGroup(BaseModel):
    id: str
    name: str
    description: str | None = None
    photo_url: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    member_count: int
    distance_km: float
