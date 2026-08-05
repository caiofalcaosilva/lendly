from fastapi import APIRouter, Depends

from app.dependencies import get_current_admin
from app.models.user import User
from app.schemas.admin_dashboard import AdminDashboardSummary
from app.services import admin_dashboard_service

router = APIRouter()


@router.get("/dashboard", response_model=AdminDashboardSummary)
def get_dashboard(admin: User = Depends(get_current_admin)):
    """Platform-wide summary: signups, top categories/cities, pending
    reports and verifications."""
    return admin_dashboard_service.get_admin_dashboard()
