import secrets
from datetime import datetime, timedelta

from fastapi import BackgroundTasks, HTTPException, status
from jose import JWTError
from mongoengine import Q

from app.config import settings
from app.models.group import Group
from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.user import RefreshSession, User
from app.schemas.auth import TotpSetupResponse
from app.schemas.user import (
    AccountDeleteRequest,
    LoginResponse,
    RefreshResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services import email_service, group_service, totp_service
from app.services.platform_settings_service import get_settings as get_platform_settings
from app.utils.security import (
    create_access_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
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
        created_at=user.created_at,
    )


def _make_access_token(user: User) -> str:
    return create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=get_platform_settings().access_token_expire_minutes),
    )


def _make_temp_token(user: User) -> str:
    """Short-lived token used only to complete a pending 2FA challenge."""
    return create_access_token(
        data={"sub": str(user.id), "type": "2fa_pending"},
        expires_delta=timedelta(minutes=10),
    )


def _new_device_token() -> str:
    return secrets.token_urlsafe(32)


def _add_trusted_device(user: User, device_token: str) -> None:
    devices = list(user.trusted_devices or [])
    if device_token not in devices:
        devices.append(device_token)
        user.update(trusted_devices=devices[-20:])


def _new_refresh_session(user: User) -> str:
    """Mints a new opaque refresh token, storing only its hash, and prunes expired ones."""
    token = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    sessions = [s for s in (user.refresh_sessions or []) if s.expires_at > now]
    sessions.append(
        RefreshSession(
            token_hash=hash_refresh_token(token),
            expires_at=now + timedelta(days=get_platform_settings().refresh_token_expire_days),
        )
    )
    user.update(refresh_sessions=sessions[-50:])
    return token


# ── Auth flows ────────────────────────────────────────────────────────────────

def register_user(data: UserCreate, background_tasks: BackgroundTasks) -> TokenResponse:
    if User.objects(email=data.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    cnpj_digits = None
    if data.account_type == "business":
        cnpj_digits = "".join(c for c in data.cnpj if c.isdigit())
        if User.objects(cnpj=cnpj_digits).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="CNPJ already registered"
            )

    verification_token = secrets.token_urlsafe(32)
    device_token = _new_device_token()

    user = User(
        name=data.name,
        email=data.email,
        phone=data.phone,
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
        email_verification_token=verification_token,
        email_verification_expires=datetime.utcnow() + timedelta(hours=get_platform_settings().email_verification_expire_hours),
        trusted_devices=[device_token],
        account_type=data.account_type,
        company_name=data.company_name,
        trade_name=data.trade_name,
        cnpj=cnpj_digits,
        business_category=data.business_category,
        business_phone=data.business_phone,
        business_hours=data.business_hours,
        website=data.website,
    )
    user.save()

    background_tasks.add_task(
        email_service.send_verification_email,
        user.email,
        user.name,
        verification_token,
    )

    return TokenResponse(
        access_token=_make_access_token(user),
        refresh_token=_new_refresh_session(user),
        user=user_to_response(user),
        device_token=device_token,
    )


def login_user(data: UserLogin) -> LoginResponse:
    user = User.objects(email=data.email, is_active=True).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="E-mail não verificado. Verifique sua caixa de entrada e clique no link de ativação.",
        )

    device_trusted = bool(data.device_token and data.device_token in (user.trusted_devices or []))

    if user.totp_enabled and not device_trusted:
        return LoginResponse(requires_2fa=True, temp_token=_make_temp_token(user))

    device_token = data.device_token if device_trusted else _new_device_token()
    if not device_trusted:
        _add_trusted_device(user, device_token)

    return LoginResponse(
        access_token=_make_access_token(user),
        refresh_token=_new_refresh_session(user),
        user=user_to_response(user),
        device_token=device_token,
    )


def complete_2fa(temp_token: str, code: str, trust_device: bool) -> TokenResponse:
    try:
        payload = decode_token(temp_token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")

    if payload.get("type") != "2fa_pending":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tipo de token inválido")

    user = User.objects(id=payload["sub"], is_active=True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")

    if not totp_service.verify_code(user.totp_secret, code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código 2FA inválido")

    device_token = _new_device_token()
    if trust_device:
        _add_trusted_device(user, device_token)

    return TokenResponse(
        access_token=_make_access_token(user),
        refresh_token=_new_refresh_session(user),
        user=user_to_response(user),
        device_token=device_token,
    )


def refresh_tokens(refresh_token: str) -> RefreshResponse:
    token_hash = hash_refresh_token(refresh_token)
    user = User.objects(refresh_sessions__token_hash=token_hash, is_active=True).first()
    session = next(
        (s for s in (user.refresh_sessions if user else []) if s.token_hash == token_hash), None
    )
    if not user or not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")

    if session.revoked_at is not None:
        # Reuse of an already-rotated token — treat as a theft signal and nuke
        # every session for this user, forcing re-login on all devices.
        user.update(refresh_sessions=[])
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")

    if session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expirado")

    session.revoked_at = datetime.utcnow()
    new_refresh = _new_refresh_session(user)
    return RefreshResponse(access_token=_make_access_token(user), refresh_token=new_refresh)


def revoke_refresh_token(current_user: User, refresh_token: str) -> dict:
    token_hash = hash_refresh_token(refresh_token)
    sessions = list(current_user.refresh_sessions or [])
    for s in sessions:
        if s.token_hash == token_hash:
            s.revoked_at = datetime.utcnow()
            break
    current_user.update(refresh_sessions=sessions)
    return {"detail": "Logout realizado"}


def verify_email_token(token: str) -> UserResponse:
    user = User.objects(
        email_verification_token=token,
        email_verification_expires__gt=datetime.utcnow(),
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Link inválido ou expirado")

    user.update(is_verified=True, email_verification_token=None, email_verification_expires=None)
    user.reload()
    return user_to_response(user)


def resend_verification(current_user: User, background_tasks: BackgroundTasks) -> dict:
    if current_user.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="E-mail já verificado")

    token = secrets.token_urlsafe(32)
    current_user.update(
        email_verification_token=token,
        email_verification_expires=datetime.utcnow() + timedelta(hours=get_platform_settings().email_verification_expire_hours),
    )
    background_tasks.add_task(
        email_service.send_verification_email,
        current_user.email,
        current_user.name,
        token,
    )
    return {"detail": "E-mail de verificação enviado"}


# ── TOTP management ───────────────────────────────────────────────────────────

def setup_totp(current_user: User) -> TotpSetupResponse:
    secret = totp_service.generate_secret()
    current_user.update(totp_secret=secret)
    return TotpSetupResponse(
        secret=secret,
        uri=totp_service.provisioning_uri(secret, current_user.email),
    )


def enable_totp(code: str, current_user: User) -> UserResponse:
    if not current_user.totp_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inicie o setup primeiro em /auth/2fa/setup")
    if not totp_service.verify_code(current_user.totp_secret, code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido")

    current_user.update(totp_enabled=True)
    current_user.reload()
    return user_to_response(current_user)


def disable_totp(code: str, current_user: User) -> UserResponse:
    if not current_user.totp_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA não está ativado")
    if not totp_service.verify_code(current_user.totp_secret, code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido")

    current_user.update(totp_enabled=False, totp_secret=None)
    current_user.reload()
    return user_to_response(current_user)


_ACTIVE_LOAN_STATUSES = ["pending", "accepted", "in_progress"]


def delete_account(data: AccountDeleteRequest, current_user: User) -> None:
    """Anonymizes and deactivates the account — doesn't hard-delete the
    document, since items/reviews/messages belonging to *other* users
    reference it and must keep working (showing "Usuário removido")."""
    if not verify_password(data.password, current_user.password_hash):
        # 400, not 401 — a 401 here would trip the frontend's generic
        # "session expired" interceptor (which retries after a token refresh,
        # then evicts on a second failure) instead of surfacing this as a
        # simple form validation error. Same convention already used by
        # disable_totp's "Código inválido" below.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha incorreta")

    has_active_loan = LoanRequest.objects(
        Q(requester=current_user) | Q(owner=current_user), status__in=_ACTIVE_LOAN_STATUSES
    ).first()
    if has_active_loan:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Finalize ou cancele seus empréstimos em andamento antes de excluir a conta",
        )

    Item.objects(owner=current_user).update(is_active=False, updated_at=datetime.utcnow())

    for group in Group.objects(members=current_user):
        if str(group.created_by.id) == str(current_user.id):
            group_service.delete_group(str(group.id), current_user)
        else:
            group_service.leave_group(str(group.id), current_user)

    current_user.update(
        name="Usuário removido",
        email=f"deleted-{current_user.id}@lendly.invalid",
        password_hash=hash_password(secrets.token_urlsafe(32)),
        phone=None,
        zip_code=None,
        street=None,
        number=None,
        complement=None,
        neighborhood=None,
        city=None,
        state=None,
        latitude=None,
        longitude=None,
        company_name=None,
        trade_name=None,
        # $unset, not $set null — cnpj has a sparse unique index, and unlike
        # a plain insert (where mongoengine omits None fields entirely), an
        # explicit `.update(cnpj=None)` here would write a literal null,
        # which sparse indexes still track and can collide on.
        unset__cnpj=1,
        business_category=None,
        business_phone=None,
        business_hours=None,
        website=None,
        totp_secret=None,
        totp_enabled=False,
        trusted_devices=[],
        refresh_sessions=[],
        is_active=False,
        updated_at=datetime.utcnow(),
    )
