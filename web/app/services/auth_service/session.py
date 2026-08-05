from jose import JWTError

from app.models.user import User
from app.schemas.user import LoginResponse, RefreshResponse, TokenResponse, UserLogin
from app.services import totp_service
from app.services.auth_service._common import (
    add_trusted_device,
    make_access_token,
    make_temp_token,
    new_device_token,
    new_refresh_session,
    user_to_response,
)
from app.utils import errors
from app.utils.security import decode_token, hash_refresh_token, verify_password
from app.utils.time import utcnow


def login_user(data: UserLogin) -> LoginResponse:
    user = User.objects(email=data.email, is_active=True).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise errors.unauthorized("Invalid credentials")

    if not user.is_verified:
        raise errors.forbidden(
            "E-mail não verificado. Verifique sua caixa de entrada e clique no "
            "link de ativação."
        )

    device_trusted = bool(
        data.device_token and data.device_token in (user.trusted_devices or [])
    )

    if user.totp_enabled and not device_trusted:
        return LoginResponse(requires_2fa=True, temp_token=make_temp_token(user))

    if device_trusted:
        assert data.device_token is not None  # device_trusted implies this was truthy
        device_token = data.device_token
    else:
        device_token = new_device_token()
        add_trusted_device(user, device_token)

    return LoginResponse(
        access_token=make_access_token(user),
        refresh_token=new_refresh_session(user),
        user=user_to_response(user),
        device_token=device_token,
    )


def complete_2fa(temp_token: str, code: str, trust_device: bool) -> TokenResponse:
    try:
        payload = decode_token(temp_token)
    except JWTError as err:
        raise errors.unauthorized(
            "Token inválido ou expirado",
        ) from err

    if payload.get("type") != "2fa_pending":
        raise errors.unauthorized("Tipo de token inválido")

    user = User.objects(id=payload["sub"], is_active=True).first()
    if not user:
        raise errors.unauthorized("Usuário não encontrado")

    if not totp_service.verify_code(user.totp_secret, code):
        raise errors.bad_request("Código 2FA inválido")

    device_token = new_device_token()
    if trust_device:
        add_trusted_device(user, device_token)

    return TokenResponse(
        access_token=make_access_token(user),
        refresh_token=new_refresh_session(user),
        user=user_to_response(user),
        device_token=device_token,
    )


def refresh_tokens(refresh_token: str) -> RefreshResponse:
    token_hash = hash_refresh_token(refresh_token)
    user = User.objects(refresh_sessions__token_hash=token_hash, is_active=True).first()
    session = next(
        (
            s
            for s in (user.refresh_sessions if user else [])
            if s.token_hash == token_hash
        ),
        None,
    )
    if not user or not session:
        raise errors.unauthorized("Refresh token inválido")

    if session.revoked_at is not None:
        # Reuse of an already-rotated token — treat as a theft signal and nuke
        # every session for this user, forcing re-login on all devices.
        user.update(refresh_sessions=[])
        raise errors.unauthorized("Refresh token inválido")

    if session.expires_at < utcnow():
        raise errors.unauthorized("Refresh token expirado")

    session.revoked_at = utcnow()
    new_refresh = new_refresh_session(user)
    return RefreshResponse(
        access_token=make_access_token(user), refresh_token=new_refresh
    )


def revoke_refresh_token(current_user: User, refresh_token: str) -> dict:
    token_hash = hash_refresh_token(refresh_token)
    sessions = list(current_user.refresh_sessions or [])
    for s in sessions:
        if s.token_hash == token_hash:
            s.revoked_at = utcnow()
            break
    current_user.update(refresh_sessions=sessions)
    return {"detail": "Logout realizado"}
