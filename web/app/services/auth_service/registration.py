import secrets
from datetime import timedelta

from fastapi import BackgroundTasks, Request

from app.models.user import BusinessProfile, TermsAcceptance, User
from app.schemas.user import TokenResponse, UserCreate, UserResponse
from app.services import email_service
from app.services.auth_service._common import (
    client_info,
    make_access_token,
    new_device_token,
    new_refresh_session,
    user_to_response,
)
from app.services.platform_settings_service import get_settings as get_platform_settings
from app.utils import errors
from app.utils.security import hash_password
from app.utils.time import utcnow
from app.utils.validators import normalize_digits

# Bumped whenever the terms of use / privacy policy text changes materially —
# stamped on the user at registration as consent evidence (see
# terms_accepted_version on the User model). Not tied to app releases.
CURRENT_TERMS_VERSION = "2026-08-13"


def register_user(
    data: UserCreate, background_tasks: BackgroundTasks, request: Request | None = None
) -> TokenResponse:
    if User.objects(email=data.email).first():
        raise errors.conflict("Email already registered")

    cnpj_digits = None
    if data.account_type == "business":
        assert data.cnpj is not None  # enforced by UserCreate's model_validator
        cnpj_digits = "".join(c for c in data.cnpj if c.isdigit())
        if User.objects(business_profile__cnpj=cnpj_digits).first():
            raise errors.conflict("CNPJ already registered")

    verification_token = secrets.token_urlsafe(32)
    device_token = new_device_token()
    ip, user_agent = client_info(request)

    user = User(
        name=data.name,
        email=data.email,
        phone=normalize_digits(data.phone) if data.phone else None,
        zip_code=data.zip_code,
        street=data.street,
        number=data.number,
        complement=data.complement,
        neighborhood=data.neighborhood,
        city=data.city,
        state=data.state,
        latitude=data.latitude,
        longitude=data.longitude,
        password_hash=hash_password(data.password),
        is_verified=False,
        terms_acceptance=TermsAcceptance(
            version=CURRENT_TERMS_VERSION, accepted_at=utcnow(), ip_address=ip
        ),
        email_verification_token=verification_token,
        email_verification_expires=utcnow()
        + timedelta(hours=get_platform_settings().email_verification_expire_hours),
        trusted_devices=[device_token],
        account_type=data.account_type,
        business_profile=BusinessProfile(
            company_name=data.company_name,
            trade_name=data.trade_name,
            cnpj=cnpj_digits,
            business_category=data.business_category,
            business_phone=normalize_digits(data.business_phone)
            if data.business_phone
            else None,
            business_hours=data.business_hours,
            website=data.website,
            # Previously never set at registration despite being accepted
            # by UserCreate — only reachable via /users/me afterward.
            instagram=data.instagram,
            whatsapp=normalize_digits(data.whatsapp) if data.whatsapp else None,
        )
        if data.account_type == "business"
        else None,
    )
    user.save()

    background_tasks.add_task(
        email_service.send_verification_email,
        user.email,
        user.name,
        verification_token,
    )

    return TokenResponse(
        access_token=make_access_token(user),
        refresh_token=new_refresh_session(user, ip, user_agent),
        user=user_to_response(user),
        device_token=device_token,
    )


def verify_email_token(token: str) -> UserResponse:
    user = User.objects(
        email_verification_token=token,
        email_verification_expires__gt=utcnow(),
    ).first()
    if not user:
        raise errors.bad_request("Link inválido ou expirado")

    user.update(
        is_verified=True, email_verification_token=None, email_verification_expires=None
    )
    user.reload()
    return user_to_response(user)


def resend_verification(current_user: User, background_tasks: BackgroundTasks) -> dict:
    if current_user.is_verified:
        raise errors.bad_request("E-mail já verificado")

    token = secrets.token_urlsafe(32)
    current_user.update(
        email_verification_token=token,
        email_verification_expires=utcnow()
        + timedelta(hours=get_platform_settings().email_verification_expire_hours),
    )
    background_tasks.add_task(
        email_service.send_verification_email,
        current_user.email,
        current_user.name,
        token,
    )
    return {"detail": "E-mail de verificação enviado"}
