from app.config import settings
from app.models.platform_settings import PlatformSettings
from app.models.user import User
from app.schemas.platform_settings import (
    AnnouncementResponse,
    PlatformSettingsResponse,
    PlatformSettingsUpdate,
)
from app.utils.time import utcnow


def _to_response(doc: PlatformSettings) -> PlatformSettingsResponse:
    return PlatformSettingsResponse(
        access_token_expire_minutes=doc.access_token_expire_minutes,
        refresh_token_expire_days=doc.refresh_token_expire_days,
        email_verification_expire_hours=doc.email_verification_expire_hours,
        login_rate_limit_per_minute=doc.login_rate_limit_per_minute,
        register_rate_limit_per_minute=doc.register_rate_limit_per_minute,
        complete_2fa_rate_limit_per_minute=doc.complete_2fa_rate_limit_per_minute,
        refresh_rate_limit_per_minute=doc.refresh_rate_limit_per_minute,
        resend_verification_rate_limit_per_minute=(
            doc.resend_verification_rate_limit_per_minute
        ),
        chat_message_rate_limit_per_minute=doc.chat_message_rate_limit_per_minute,
        password_reset_rate_limit_per_minute=doc.password_reset_rate_limit_per_minute,
        group_create_rate_limit_per_minute=doc.group_create_rate_limit_per_minute,
        group_post_rate_limit_per_minute=doc.group_post_rate_limit_per_minute,
        handoff_confirmation_grace_hours=doc.handoff_confirmation_grace_hours,
        announcement_message=doc.announcement_message,
        announcement_active=doc.announcement_active or False,
        updated_by_name=doc.updated_by.name if doc.updated_by else None,
        updated_at=doc.updated_at,
    )


def get_settings() -> PlatformSettings:
    """Lazy singleton — the first read seeds a row from today's .env-derived
    defaults, so nothing changes behaviorally until an admin actually edits
    something in /admin/settings."""
    doc = PlatformSettings.objects().first()
    if not doc:
        doc = PlatformSettings(
            access_token_expire_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            refresh_token_expire_days=settings.REFRESH_TOKEN_EXPIRE_DAYS,
            email_verification_expire_hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS,
        )
        doc.save()
    return doc


def get_settings_response() -> PlatformSettingsResponse:
    return _to_response(get_settings())


def update_settings(
    data: PlatformSettingsUpdate, admin: User
) -> PlatformSettingsResponse:
    doc = get_settings()
    updates = data.model_dump(exclude_none=True)
    doc.update(**updates, updated_by=admin, updated_at=utcnow())
    doc.reload()
    return _to_response(doc)


def get_announcement() -> AnnouncementResponse:
    """Public, unauthenticated — every visitor sees this, not just logged-in
    users. See routers/admin/settings.py for editing and GET /announcement
    in main.py for where this is exposed."""
    doc = get_settings()
    return AnnouncementResponse(
        message=doc.announcement_message, active=doc.announcement_active or False
    )
