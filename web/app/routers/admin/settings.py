from fastapi import APIRouter, Depends

from app.dependencies import get_current_admin
from app.models.user import User
from app.schemas.platform_settings import (
    PlatformSettingsResponse,
    PlatformSettingsUpdate,
)
from app.services import platform_settings_service

router = APIRouter(prefix="/settings")


@router.get("", response_model=PlatformSettingsResponse)
def get_platform_settings(admin: User = Depends(get_current_admin)):
    """Admin — current platform settings (token lifetimes, rate limits,
    announcement banner). Lazily seeded with defaults on first read."""
    return platform_settings_service.get_settings_response()


@router.patch("", response_model=PlatformSettingsResponse)
def update_platform_settings(
    data: PlatformSettingsUpdate, admin: User = Depends(get_current_admin)
):
    """Admin — updates platform settings; only fields present in the
    payload are changed."""
    return platform_settings_service.update_settings(data, admin)
