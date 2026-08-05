from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_admin
from app.models.user import User
from app.schemas.admin_actions import AdminActionEntry
from app.services import admin_action_service

router = APIRouter()


@router.get("/actions", response_model=list[AdminActionEntry])
def get_actions(
    limit: int = Query(50, ge=1, le=100), admin: User = Depends(get_current_admin)
):
    """Admin — recent history of admin actions (activations, promotions,
    review deletions, report resolutions...)."""
    return admin_action_service.get_admin_actions(limit)
