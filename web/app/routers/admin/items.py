from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_admin
from app.models.user import User
from app.schemas.admin_items import AdminItemSummary
from app.schemas.bulk import BulkActionRequest, BulkActionResult
from app.services import admin_item_service

router = APIRouter(prefix="/items")


@router.get("", response_model=list[AdminItemSummary])
def list_items(
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_current_admin),
):
    """Admin — paginated item list with optional title/description
    search."""
    return admin_item_service.list_items(search, skip, limit)


@router.get("/{item_id}", response_model=AdminItemSummary)
def get_item(item_id: str, admin: User = Depends(get_current_admin)):
    """Admin — a single item's detail."""
    return admin_item_service.get_item(item_id)


@router.patch("/{item_id}/deactivate", response_model=AdminItemSummary)
def deactivate_item(item_id: str, admin: User = Depends(get_current_admin)):
    """Admin — moderation deactivation of an item (distinct from the
    owner's own activate/deactivate toggle)."""
    return admin_item_service.deactivate_item(item_id, admin)


@router.patch("/{item_id}/activate", response_model=AdminItemSummary)
def activate_item(item_id: str, admin: User = Depends(get_current_admin)):
    """Admin — reactivates a previously (admin-)deactivated item."""
    return admin_item_service.activate_item(item_id, admin)


@router.post("/bulk-activate", response_model=BulkActionResult)
def bulk_activate_items(
    data: BulkActionRequest, admin: User = Depends(get_current_admin)
):
    """Admin — activates several items at once; per-id failures don't stop
    the rest of the batch."""
    return admin_item_service.bulk_activate_items(data.ids, admin)


@router.post("/bulk-deactivate", response_model=BulkActionResult)
def bulk_deactivate_items(
    data: BulkActionRequest, admin: User = Depends(get_current_admin)
):
    """Admin — deactivates several items at once; per-id failures don't
    stop the rest of the batch."""
    return admin_item_service.bulk_deactivate_items(data.ids, admin)
