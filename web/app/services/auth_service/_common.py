import secrets
from datetime import timedelta

from app.models.user import RefreshSession, User
from app.schemas.user import PublicUserResponse, UserResponse
from app.services.platform_settings_service import get_settings as get_platform_settings
from app.utils.security import create_access_token, hash_refresh_token
from app.utils.time import utcnow


def user_to_public_response(user: User) -> PublicUserResponse:
    return PublicUserResponse(
        id=str(user.id),
        name=user.name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        neighborhood=user.neighborhood,
        city=user.city,
        state=user.state,
        average_rating=user.average_rating,
        rating_count=user.rating_count,
        reliability_score=user.reliability_score,
        reliability_count=user.reliability_count or 0,
        on_time_rate=user.on_time_rate,
        finished_loans_count=user.finished_loans_count or 0,
        account_type=user.account_type or "individual",
        trade_name=user.trade_name,
        business_category=user.business_category,
        business_phone=user.business_phone,
        business_hours=user.business_hours,
        website=user.website,
        instagram=user.instagram,
        whatsapp=user.whatsapp,
        featured_item_ids=[str(i.id) for i in (user.featured_items or [])],
        created_at=user.created_at,
    )


def user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        avatar_url=user.avatar_url,
        bio=user.bio,
        phone=user.phone,
        zip_code=user.zip_code,
        street=user.street,
        number=user.number,
        complement=user.complement,
        neighborhood=user.neighborhood,
        city=user.city,
        state=user.state,
        latitude=user.latitude,
        longitude=user.longitude,
        is_verified=user.is_verified or False,
        totp_enabled=user.totp_enabled or False,
        is_admin=user.is_admin or False,
        cpf=user.cpf,
        identity_status=user.identity_status or "none",
        average_rating=user.average_rating,
        rating_count=user.rating_count,
        reliability_score=user.reliability_score,
        reliability_count=user.reliability_count or 0,
        on_time_rate=user.on_time_rate,
        finished_loans_count=user.finished_loans_count or 0,
        account_type=user.account_type or "individual",
        company_name=user.company_name,
        trade_name=user.trade_name,
        cnpj=user.cnpj,
        business_category=user.business_category,
        business_phone=user.business_phone,
        business_hours=user.business_hours,
        website=user.website,
        instagram=user.instagram,
        whatsapp=user.whatsapp,
        featured_item_ids=[str(i.id) for i in (user.featured_items or [])],
        created_at=user.created_at,
    )


def make_access_token(user: User) -> str:
    return create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(
            minutes=get_platform_settings().access_token_expire_minutes
        ),
    )


def make_temp_token(user: User) -> str:
    """Short-lived token used only to complete a pending 2FA challenge."""
    return create_access_token(
        data={"sub": str(user.id), "type": "2fa_pending"},
        expires_delta=timedelta(minutes=10),
    )


def new_device_token() -> str:
    return secrets.token_urlsafe(32)


def add_trusted_device(user: User, device_token: str) -> None:
    devices = list(user.trusted_devices or [])
    if device_token not in devices:
        devices.append(device_token)
        user.update(trusted_devices=devices[-20:])


def new_refresh_session(user: User) -> str:
    """Mints a new opaque refresh token, storing only its hash, and prunes expired
    ones."""
    token = secrets.token_urlsafe(32)
    now = utcnow()
    sessions = [s for s in (user.refresh_sessions or []) if s.expires_at > now]
    sessions.append(
        RefreshSession(
            token_hash=hash_refresh_token(token),
            expires_at=now
            + timedelta(days=get_platform_settings().refresh_token_expire_days),
        )
    )
    user.update(refresh_sessions=sessions[-50:])
    return token
