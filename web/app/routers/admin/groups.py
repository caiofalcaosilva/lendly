from fastapi import APIRouter, BackgroundTasks, Depends, Query

from app.dependencies import get_current_admin
from app.models.user import User
from app.schemas.group import AdminGroupSummary, GroupResponse
from app.services import group_service

router = APIRouter(prefix="/groups")


@router.get("", response_model=list[AdminGroupSummary])
def list_all_groups(
    search: str | None = Query(None, description="Filter by name (case-insensitive)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_current_admin),
):
    """Admin — every group on the platform, not just ones the admin
    belongs to. Newest first."""
    return group_service.list_all_groups(search, skip, limit)


@router.delete("/{group_id}", status_code=204)
def admin_delete_group(
    group_id: str,
    background_tasks: BackgroundTasks,
    admin: User = Depends(get_current_admin),
):
    """Admin — moderation deletion of any group, regardless of creator."""
    group_service.admin_delete_group(group_id, admin, background_tasks)


@router.delete("/{group_id}/members/{user_id}", response_model=GroupResponse)
def admin_remove_member(
    group_id: str,
    user_id: str,
    background_tasks: BackgroundTasks,
    admin: User = Depends(get_current_admin),
):
    """Admin — removes a member from a group. The creator can't be removed
    this way (delete the group instead)."""
    return group_service.admin_remove_member(group_id, user_id, admin, background_tasks)
