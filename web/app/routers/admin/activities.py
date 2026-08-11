from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_admin
from app.models.activity import ACTIVITY_EVENTS
from app.models.user import User
from app.schemas.activity import AdminActivityResponse
from app.services import admin_activity_service
from app.utils import errors

router = APIRouter(prefix="/activities")


@router.get("", response_model=list[AdminActivityResponse])
def list_activities(
    recipient_id: str | None = Query(
        None, description="Whose activity — the person it happened to"
    ),
    actor_id: str | None = Query(None, description="Who performed the action"),
    event: str | None = Query(None, description="Exact event, e.g. rental.accepted"),
    resource_type: str | None = Query(
        None,
        description=(
            "item | loan_request | payment | review | verification | "
            "group | report | user"
        ),
    ),
    date_from: datetime | None = Query(
        None, description="Only activity at/after this timestamp"
    ),
    date_to: datetime | None = Query(
        None, description="Only activity at/before this timestamp"
    ),
    before_id: str | None = Query(
        None, description="Id of the last row seen — returns the page before it"
    ),
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_current_admin),
):
    """Admin — searches Activity across every user, not just the caller's
    own (unlike GET /activities/). Any combination of filters may be
    combined; none are required."""
    if event is not None and event not in ACTIVITY_EVENTS:
        raise errors.bad_request(f"Invalid event '{event}'")
    return admin_activity_service.list_activities(
        recipient_id=recipient_id,
        actor_id=actor_id,
        event=event,
        resource_type=resource_type,
        date_from=date_from,
        date_to=date_to,
        before_id=before_id,
        limit=limit,
    )
