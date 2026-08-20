from datetime import datetime

from pydantic import BaseModel, Field


class PlatformSettingsUpdate(BaseModel):
    access_token_expire_minutes: int | None = Field(None, ge=1)
    refresh_token_expire_days: int | None = Field(None, ge=1)
    email_verification_expire_hours: int | None = Field(None, ge=1)
    login_rate_limit_per_minute: int | None = Field(None, ge=1)
    register_rate_limit_per_minute: int | None = Field(None, ge=1)
    complete_2fa_rate_limit_per_minute: int | None = Field(None, ge=1)
    refresh_rate_limit_per_minute: int | None = Field(None, ge=1)
    resend_verification_rate_limit_per_minute: int | None = Field(None, ge=1)
    phone_verification_expire_minutes: int | None = Field(None, ge=1)
    phone_verification_rate_limit_per_minute: int | None = Field(None, ge=1)
    chat_message_rate_limit_per_minute: int | None = Field(None, ge=1)
    password_reset_rate_limit_per_minute: int | None = Field(None, ge=1)
    group_create_rate_limit_per_minute: int | None = Field(None, ge=1)
    group_post_rate_limit_per_minute: int | None = Field(None, ge=1)
    handoff_confirmation_grace_hours: int | None = Field(None, ge=1)
    claim_filing_window_hours: int | None = Field(None, ge=1)
    claim_payment_deadline_days: int | None = Field(None, ge=1)
    claim_late_fee_percent: float | None = Field(None, ge=0)
    announcement_message: str | None = Field(None, max_length=280)
    announcement_active: bool | None = None


class PlatformSettingsResponse(BaseModel):
    access_token_expire_minutes: int
    refresh_token_expire_days: int
    email_verification_expire_hours: int
    login_rate_limit_per_minute: int
    register_rate_limit_per_minute: int
    complete_2fa_rate_limit_per_minute: int
    refresh_rate_limit_per_minute: int
    resend_verification_rate_limit_per_minute: int
    phone_verification_expire_minutes: int
    phone_verification_rate_limit_per_minute: int
    chat_message_rate_limit_per_minute: int
    password_reset_rate_limit_per_minute: int
    group_create_rate_limit_per_minute: int
    group_post_rate_limit_per_minute: int
    handoff_confirmation_grace_hours: int
    claim_filing_window_hours: int
    claim_payment_deadline_days: int
    claim_late_fee_percent: float
    announcement_message: str | None = None
    announcement_active: bool = False
    updated_by_name: str | None = None
    updated_at: datetime | None = None


class AnnouncementResponse(BaseModel):
    message: str | None = None
    active: bool = False
