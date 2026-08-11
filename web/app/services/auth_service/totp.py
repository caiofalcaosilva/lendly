from app.models.user import User
from app.schemas.auth import TotpSetupResponse
from app.schemas.user import UserResponse
from app.services import activity_service, totp_service
from app.services.auth_service._common import user_to_response
from app.utils import errors


def setup_totp(current_user: User) -> TotpSetupResponse:
    if current_user.totp_enabled:
        raise errors.bad_request(
            "2FA já está ativado. Desative antes de gerar um novo QR code."
        )
    secret = totp_service.generate_secret()
    current_user.update(totp_secret=secret)
    return TotpSetupResponse(
        secret=secret,
        uri=totp_service.provisioning_uri(secret, current_user.email),
    )


def enable_totp(code: str, current_user: User) -> UserResponse:
    if not current_user.totp_secret:
        raise errors.bad_request("Inicie o setup primeiro em /auth/2fa/setup")
    if not totp_service.verify_code(current_user.totp_secret, code):
        raise errors.bad_request("Código inválido")

    current_user.update(totp_enabled=True)
    current_user.reload()
    activity_service.record(
        recipient=current_user,
        event="account.2fa_enabled",
        actor=current_user,
        resource_type="user",
        resource_id=str(current_user.id),
    )
    return user_to_response(current_user)


def disable_totp(code: str, current_user: User) -> UserResponse:
    if not current_user.totp_enabled:
        raise errors.bad_request("2FA não está ativado")
    if not totp_service.verify_code(current_user.totp_secret, code):
        raise errors.bad_request("Código inválido")

    current_user.update(totp_enabled=False, totp_secret=None)
    current_user.reload()
    activity_service.record(
        recipient=current_user,
        event="account.2fa_disabled",
        actor=current_user,
        resource_type="user",
        resource_id=str(current_user.id),
    )
    return user_to_response(current_user)
