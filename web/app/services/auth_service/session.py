from fastapi import BackgroundTasks, Request
from jose import JWTError

from app.models.user import User
from app.schemas.user import (
    LoginHistoryEntry,
    LoginResponse,
    RefreshResponse,
    SessionSummary,
    TokenResponse,
    UserLogin,
)
from app.services import (
    activity_service,
    email_service,
    notification_service,
    totp_service,
)
from app.services.auth_service._common import (
    add_trusted_device,
    client_info,
    make_access_token,
    make_temp_token,
    new_device_token,
    new_refresh_session,
    user_to_response,
)
from app.utils import errors
from app.utils.security import decode_token, hash_refresh_token, verify_password
from app.utils.time import utcnow


def login_user(
    data: UserLogin,
    request: Request | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> LoginResponse:
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

    ip, user_agent = client_info(request)

    if device_trusted:
        assert data.device_token is not None  # device_trusted implies this was truthy
        device_token = data.device_token
    else:
        device_token = new_device_token()
        add_trusted_device(user, device_token)
        if background_tasks:
            background_tasks.add_task(
                email_service.send_new_login_email,
                user.email,
                user.name,
                ip,
                user_agent,
            )
            background_tasks.add_task(
                notification_service.create_notification,
                user,
                "new_login",
                "Novo login detectado",
                f"{user_agent} · {ip}" if user_agent else ip,
                "/profile",
            )
            activity_service.record(
                recipient=user,
                event="account.new_login",
                resource_type="user",
                resource_id=str(user.id),
                metadata={"ip_address": ip, "user_agent": user_agent},
            )

    return LoginResponse(
        access_token=make_access_token(user),
        refresh_token=new_refresh_session(user, ip, user_agent),
        user=user_to_response(user),
        device_token=device_token,
    )


def complete_2fa(
    temp_token: str,
    code: str,
    trust_device: bool,
    request: Request | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> TokenResponse:
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

    ip, user_agent = client_info(request)
    # Reaching this endpoint always means a device that wasn't already
    # trusted — the direct-login path skips 2FA entirely otherwise.
    if background_tasks:
        background_tasks.add_task(
            email_service.send_new_login_email, user.email, user.name, ip, user_agent
        )
        background_tasks.add_task(
            notification_service.create_notification,
            user,
            "new_login",
            "Novo login detectado",
            f"{user_agent} · {ip}" if user_agent else ip,
            "/profile",
        )
        activity_service.record(
            recipient=user,
            event="account.new_login",
            resource_type="user",
            resource_id=str(user.id),
            metadata={"ip_address": ip, "user_agent": user_agent},
        )
    return TokenResponse(
        access_token=make_access_token(user),
        refresh_token=new_refresh_session(user, ip, user_agent),
        user=user_to_response(user),
        device_token=device_token,
    )


def refresh_tokens(
    refresh_token: str, request: Request | None = None
) -> RefreshResponse:
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
    ip, user_agent = client_info(request)
    new_refresh = new_refresh_session(user, ip, user_agent)
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


def get_sessions(current_user: User) -> list[SessionSummary]:
    """Every still-valid (not revoked, not expired) session — what /profile
    shows as "dispositivos conectados". The access token used to call this
    endpoint isn't itself one of these; only refresh sessions are tracked."""
    now = utcnow()
    return [
        SessionSummary(
            id=s.token_hash,
            created_at=s.created_at,
            expires_at=s.expires_at,
            ip_address=s.ip_address,
            user_agent=s.user_agent,
        )
        for s in (current_user.refresh_sessions or [])
        if s.revoked_at is None and s.expires_at > now
    ]


def get_login_history(current_user: User) -> list[LoginHistoryEntry]:
    """Passive log, most recent first — unlike get_sessions, includes
    revoked/expired entries too, since this is for the user to spot
    something suspicious, not to manage active sessions."""
    sessions = sorted(
        current_user.refresh_sessions or [], key=lambda s: s.created_at, reverse=True
    )
    return [
        LoginHistoryEntry(
            created_at=s.created_at,
            ip_address=s.ip_address,
            user_agent=s.user_agent,
            revoked=s.revoked_at is not None,
        )
        for s in sessions
    ]


def revoke_session(session_id: str, current_user: User) -> dict:
    sessions = list(current_user.refresh_sessions or [])
    for s in sessions:
        if s.token_hash == session_id:
            s.revoked_at = utcnow()
            break
    current_user.update(refresh_sessions=sessions)
    return {"detail": "Sessão revogada"}
