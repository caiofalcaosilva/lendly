from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response

from app.dependencies import get_current_admin
from app.models.activity import ACTIVITY_EVENTS
from app.models.user import User
from app.services import admin_export_service
from app.utils import errors
from app.utils.time import utcnow

router = APIRouter(prefix="/export")


def _csv_response(content: str, name: str) -> Response:
    filename = f"lendly-{name}-{utcnow().date().isoformat()}.csv"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/users")
def export_users(admin: User = Depends(get_current_admin)):
    """Admin — downloads every user as CSV."""
    return _csv_response(admin_export_service.export_users_csv(), "usuarios")


@router.get("/items")
def export_items(admin: User = Depends(get_current_admin)):
    """Admin — downloads every item as CSV."""
    return _csv_response(admin_export_service.export_items_csv(), "itens")


@router.get("/loan-requests")
def export_loan_requests(admin: User = Depends(get_current_admin)):
    """Admin — downloads every loan request as CSV."""
    return _csv_response(admin_export_service.export_loan_requests_csv(), "emprestimos")


@router.get("/activities")
def export_activities(
    recipient_id: str | None = Query(None),
    actor_id: str | None = Query(None),
    event: str | None = Query(None),
    resource_type: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    admin: User = Depends(get_current_admin),
):
    """Admin — downloads the current /admin/activities search as CSV. Same
    filters, same meaning; unlike the other three exports, this is a
    filtered slice, not the whole collection."""
    if event is not None and event not in ACTIVITY_EVENTS:
        raise errors.bad_request(f"Invalid event '{event}'")
    return _csv_response(
        admin_export_service.export_activities_csv(
            recipient_id=recipient_id,
            actor_id=actor_id,
            event=event,
            resource_type=resource_type,
            date_from=date_from,
            date_to=date_to,
        ),
        "atividades",
    )
