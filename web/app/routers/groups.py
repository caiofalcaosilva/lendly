from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.group import GroupCreate, GroupResponse, GroupSummary, JoinGroupRequest
from app.schemas.item import ItemResponse
from app.services import group_service, item_service

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("/", response_model=GroupResponse, status_code=201)
def create_group(data: GroupCreate, current_user: User = Depends(get_current_user)):
    """Creates a private group with a shareable invite code — the creator
    becomes its first member."""
    return group_service.create_group(data, current_user)


@router.get("/me", response_model=list[GroupSummary])
def my_groups(current_user: User = Depends(get_current_user)):
    """Groups the logged-in user belongs to."""
    return group_service.get_my_groups(current_user)


@router.post("/join", response_model=GroupResponse)
def join_group(data: JoinGroupRequest, current_user: User = Depends(get_current_user)):
    """Joins a group via its invite code."""
    return group_service.join_group(data.invite_code, current_user)


@router.get("/{group_id}", response_model=GroupResponse)
def get_group(group_id: str, current_user: User = Depends(get_current_user)):
    """A group's detail and member list — members only, admins can also
    read groups they're not in."""
    return group_service.get_group(group_id, current_user)


@router.post("/{group_id}/leave")
def leave_group(group_id: str, current_user: User = Depends(get_current_user)):
    """Leaves a group — the creator can't leave (delete the group
    instead)."""
    return group_service.leave_group(group_id, current_user)


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: str, current_user: User = Depends(get_current_user)):
    """Deletes a group — creator only."""
    group_service.delete_group(group_id, current_user)


@router.get("/{group_id}/items", response_model=list[ItemResponse])
def group_items(group_id: str, current_user: User = Depends(get_current_user)):
    """Items shared with a group — members only."""
    return item_service.list_group_items(group_id, current_user)
