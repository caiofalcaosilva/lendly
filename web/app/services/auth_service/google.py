from fastapi import BackgroundTasks, Request

from app.config import settings
from app.models.user import User
from app.schemas.user import LoginResponse
from app.services import (
    activity_service,
    email_service,
    google_oauth_gateway,
    notification_service,
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
from app.services.auth_service.registration import CURRENT_TERMS_VERSION
from app.services.google_oauth_gateway import GoogleOAuthError
from app.utils import errors
from app.utils.time import utcnow


def google_login(
    code: str,
    device_token: str | None,
    request: Request | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> LoginResponse:
    """Signs in via Google, creating an account on first use. An existing
    password-based account with the same email gets google_id linked onto
    it instead of a duplicate — safe because Google has already confirmed
    that email belongs to whoever's completing this flow.

    A brand-new account trusts its first device outright, same as
    register_user — there's nothing to protect yet. An *existing* account
    still goes through the same totp_enabled/device-trust gate login_user
    does: signing in via Google must not become a way around 2FA someone
    already turned on."""
    try:
        access_token = google_oauth_gateway.exchange_code(
            code, settings.GOOGLE_REDIRECT_URI
        )
        info = google_oauth_gateway.get_userinfo(access_token)
    except GoogleOAuthError as e:
        raise errors.bad_gateway(str(e)) from e

    google_id = info.get("sub")
    email = info.get("email")
    if not google_id or not email:
        raise errors.bad_gateway("Resposta incompleta da Google")

    ip, user_agent = client_info(request)

    user = User.objects(google_id=google_id).first()
    is_new = False
    if not user:
        user = User.objects(email=email).first()
        if user:
            user.update(google_id=google_id)
            user.reload()
        else:
            is_new = True
            device_token = new_device_token()
            user = User(
                name=info.get("name") or email.split("@")[0],
                email=email,
                avatar_url=info.get("picture"),
                google_id=google_id,
                is_verified=True,  # Google already confirmed this email.
                terms_accepted_version=CURRENT_TERMS_VERSION,
                terms_accepted_at=utcnow(),
                terms_accepted_ip=ip,
                trusted_devices=[device_token],
                account_type="individual",  # No CNPJ/trade info from Google.
            )
            user.save()

    if not is_new:
        device_trusted = bool(
            device_token and device_token in (user.trusted_devices or [])
        )
        if user.totp_enabled and not device_trusted:
            return LoginResponse(requires_2fa=True, temp_token=make_temp_token(user))

        if device_trusted:
            assert device_token is not None  # implied by device_trusted
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
