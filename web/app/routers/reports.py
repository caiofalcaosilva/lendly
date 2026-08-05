from fastapi import APIRouter, Depends

from app.dependencies import get_current_admin, get_current_user
from app.models.user import User
from app.schemas.report import ReportCreate, ReportResponse
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/", response_model=ReportResponse, status_code=201)
def create_report(data: ReportCreate, current_user: User = Depends(get_current_user)):
    """Flags an item or user for admin review."""
    return report_service.create_report(data, current_user)


@router.get("/", response_model=list[ReportResponse])
def list_reports(status: str | None = None, admin: User = Depends(get_current_admin)):
    """Admin — every report, optionally filtered by status."""
    return report_service.list_reports(status)


@router.patch("/{report_id}/dismiss", response_model=ReportResponse)
def dismiss_report(report_id: str, admin: User = Depends(get_current_admin)):
    """Admin — closes a report with no action taken."""
    return report_service.dismiss_report(report_id, admin)


@router.patch("/{report_id}/action", response_model=ReportResponse)
def action_report(report_id: str, admin: User = Depends(get_current_admin)):
    """Admin — upholds a report, deactivating the reported item or user."""
    return report_service.action_report(report_id, admin)
