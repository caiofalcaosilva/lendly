from fastapi import APIRouter, Depends, Response

from app.dependencies import get_current_admin
from app.models.user import User
from app.services import admin_export_service
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
