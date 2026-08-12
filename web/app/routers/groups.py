from fastapi import APIRouter, BackgroundTasks, Depends

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupResponse,
    GroupSummary,
    GroupUpdate,
    JoinGroupRequest,
)
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


@router.patch("/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: str, data: GroupUpdate, current_user: User = Depends(get_current_user)
):
    """Edits a group's name/description — creator or moderator."""
    return group_service.update_group(group_id, data, current_user)


@router.post("/{group_id}/invite-code/regenerate", response_model=GroupResponse)
def regenerate_invite_code(
    group_id: str, current_user: User = Depends(get_current_user)
):
    """Reissues the group's invite code, invalidating the old one —
    creator or moderator."""
    return group_service.regenerate_invite_code(group_id, current_user)


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


@router.post("/{group_id}/members/{user_id}/vouch", response_model=GroupResponse)
def vouch_for_member(
    group_id: str,
    user_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Confirms the logged-in user personally knows this fellow group
    member — a light trust signal scoped to people who already share a
    private, invite-only group."""
    return group_service.vouch_for_member(
        group_id, user_id, current_user, background_tasks
    )


@router.delete("/{group_id}/members/{user_id}/vouch", response_model=GroupResponse)
def unvouch_for_member(
    group_id: str, user_id: str, current_user: User = Depends(get_current_user)
):
    """Withdraws a vouch given earlier."""
    return group_service.unvouch_for_member(group_id, user_id, current_user)


@router.post("/{group_id}/members/{user_id}/moderator", response_model=GroupResponse)
def add_moderator(
    group_id: str, user_id: str, current_user: User = Depends(get_current_user)
):
    """Appoints a fellow member as moderator — creator only."""
    return group_service.add_moderator(group_id, user_id, current_user)


@router.delete("/{group_id}/members/{user_id}/moderator", response_model=GroupResponse)
def remove_moderator(
    group_id: str, user_id: str, current_user: User = Depends(get_current_user)
):
    """Revokes a member's moderator status — creator only."""
    return group_service.remove_moderator(group_id, user_id, current_user)


@router.delete("/{group_id}/members/{user_id}", response_model=GroupResponse)
def remove_member(
    group_id: str, user_id: str, current_user: User = Depends(get_current_user)
):
    """Kicks a regular member out of the group — creator or moderator.
    Unlike DELETE /admin/groups/{group_id}/members/{user_id}, this is
    group-level, not platform moderation."""
    return group_service.remove_member(group_id, user_id, current_user)
