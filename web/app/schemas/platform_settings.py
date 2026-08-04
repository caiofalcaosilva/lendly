from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PlatformSettingsUpdate(BaseModel):
    access_token_expire_minutes: Optional[int] = Field(None, ge=1)
    refresh_token_expire_days: Optional[int] = Field(None, ge=1)
    email_verification_expire_hours: Optional[int] = Field(None, ge=1)
    login_rate_limit_per_minute: Optional[int] = Field(None, ge=1)
    register_rate_limit_per_minute: Optional[int] = Field(None, ge=1)
    announcement_message: Optional[str] = Field(None, max_length=280)
    announcement_active: Optional[bool] = None


class PlatformSettingsResponse(BaseModel):
    access_token_expire_minutes: int
    refresh_token_expire_days: int
    email_verification_expire_hours: int
    login_rate_limit_per_minute: int
    register_rate_limit_per_minute: int
    announcement_message: Optional[str] = None
    announcement_active: bool = False
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None


class AnnouncementResponse(BaseModel):
    message: Optional[str] = None
    active: bool = False
