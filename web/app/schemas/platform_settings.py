from datetime import datetime

from pydantic import BaseModel, Field


class PlatformSettingsUpdate(BaseModel):
    access_token_expire_minutes: int | None = Field(None, ge=1)
    refresh_token_expire_days: int | None = Field(None, ge=1)
    email_verification_expire_hours: int | None = Field(None, ge=1)
    login_rate_limit_per_minute: int | None = Field(None, ge=1)
    register_rate_limit_per_minute: int | None = Field(None, ge=1)
    announcement_message: str | None = Field(None, max_length=280)
    announcement_active: bool | None = None


class PlatformSettingsResponse(BaseModel):
    access_token_expire_minutes: int
    refresh_token_expire_days: int
    email_verification_expire_hours: int
    login_rate_limit_per_minute: int
    register_rate_limit_per_minute: int
    announcement_message: str | None = None
    announcement_active: bool = False
    updated_by_name: str | None = None
    updated_at: datetime | None = None


class AnnouncementResponse(BaseModel):
    message: str | None = None
    active: bool = False
