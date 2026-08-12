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


class VouchCreate(BaseModel):
    note: str | None = Field(None, max_length=200)


class TransferOwnershipRequest(BaseModel):
    new_creator_id: str


class Voucher(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    note: str | None = None


class GroupMemberResponse(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    average_rating: float
    vouch_count: int = 0
    vouched_by_me: bool = False
    is_moderator: bool = False
    vouchers: list[Voucher] = []


class GroupSummary(BaseModel):
    id: str
    name: str
    member_count: int
    photo_url: str | None = None


class AdminGroupSummary(BaseModel):
    id: str
    name: str
    member_count: int
    photo_url: str | None = None
    is_discoverable: bool = False
    created_by_name: str
    created_at: datetime


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
    created_by: str
    created_at: datetime
    # Whether the caller themself is a member/moderator — members are no
    # longer embedded here (a group can have hundreds or thousands; see
    # GET /{group_id}/members), so the frontend needs another way to answer
    # "is it me" without paging through the whole list.
    is_viewer_member: bool = False
    is_viewer_moderator: bool = False


class NearbyGroup(BaseModel):
    id: str
    name: str
    description: str | None = None
    photo_url: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    member_count: int
    distance_km: float
