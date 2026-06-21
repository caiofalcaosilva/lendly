import secrets
from datetime import datetime, timedelta

from fastapi import BackgroundTasks, HTTPException, status
from jose import JWTError

from app.config import settings
from app.models.user import User
from app.schemas.auth import TotpSetupResponse
from app.schemas.user import LoginResponse, TokenResponse, UserCreate, UserLogin, UserResponse
from app.services import email_service, totp_service
from app.utils.security import create_access_token, decode_token, hash_password, verify_password


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
        average_rating=user.average_rating,
        rating_count=user.rating_count,
        created_at=user.created_at,
    )


def _make_access_token(user: User) -> str:
    return create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
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


# ── Auth flows ────────────────────────────────────────────────────────────────

def register_user(data: UserCreate, background_tasks: BackgroundTasks) -> TokenResponse:
    if User.objects(email=data.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

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
        password_hash=hash_password(data.password),
        is_verified=False,
        email_verification_token=verification_token,
        email_verification_expires=datetime.utcnow() + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS),
        trusted_devices=[device_token],
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
        user=user_to_response(user),
        device_token=device_token,
    )


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
        email_verification_expires=datetime.utcnow() + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS),
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
