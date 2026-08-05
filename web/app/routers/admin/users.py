from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_admin
from app.models.user import User
from app.schemas.admin_users import AdminUserSummary
from app.schemas.bulk import BulkActionRequest, BulkActionResult
from app.schemas.view_as import ViewAsResponse
from app.services import admin_user_service, admin_view_as_service

router = APIRouter(prefix="/users")


@router.get("", response_model=list[AdminUserSummary])
def list_users(
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_current_admin),
):
    """Admin — paginated user list with optional search over name, email,
    and trade name."""
    return admin_user_service.list_users(search, skip, limit)


@router.get("/{user_id}", response_model=AdminUserSummary)
def get_user(user_id: str, admin: User = Depends(get_current_admin)):
    """Admin — a single user's detail, including admin-only fields."""
    return admin_user_service.get_user(user_id)


@router.patch("/{user_id}/deactivate", response_model=AdminUserSummary)
def deactivate_user(user_id: str, admin: User = Depends(get_current_admin)):
    """Admin — deactivates a user. Blocked if they have a loan in
    progress."""
    return admin_user_service.deactivate_user(user_id, admin)


@router.patch("/{user_id}/activate", response_model=AdminUserSummary)
def activate_user(user_id: str, admin: User = Depends(get_current_admin)):
    """Admin — reactivates a previously deactivated user."""
    return admin_user_service.activate_user(user_id, admin)


@router.post("/bulk-activate", response_model=BulkActionResult)
def bulk_activate_users(
    data: BulkActionRequest, admin: User = Depends(get_current_admin)
):
    """Admin — activates several users at once; per-id failures don't stop
    the rest of the batch."""
    return admin_user_service.bulk_activate_users(data.ids, admin)


@router.post("/bulk-deactivate", response_model=BulkActionResult)
def bulk_deactivate_users(
    data: BulkActionRequest, admin: User = Depends(get_current_admin)
):
    """Admin — deactivates several users at once; per-id failures don't
    stop the rest of the batch."""
    return admin_user_service.bulk_deactivate_users(data.ids, admin)


@router.patch("/{user_id}/promote", response_model=AdminUserSummary)
def promote_user(user_id: str, admin: User = Depends(get_current_admin)):
    """Admin — grants another user admin access. Can't be used on
    yourself."""
    return admin_user_service.promote_user(user_id, admin)


@router.patch("/{user_id}/demote", response_model=AdminUserSummary)
def demote_user(user_id: str, admin: User = Depends(get_current_admin)):
    """Admin — revokes another admin's access. Can't be used on
    yourself."""
    return admin_user_service.demote_user(user_id, admin)


@router.post("/{user_id}/view-as", response_model=ViewAsResponse)
def view_as_user(user_id: str, admin: User = Depends(get_current_admin)):
    """Admin — mints a read-only token to browse the app as another user,
    for support/debugging. Every mutating endpoint rejects it."""
    return admin_view_as_service.create_view_as_token(admin, user_id)
