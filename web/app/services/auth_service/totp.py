from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.auth import TotpSetupResponse
from app.schemas.user import UserResponse
from app.services import totp_service
from app.services.auth_service._common import user_to_response


def setup_totp(current_user: User) -> TotpSetupResponse:
    secret = totp_service.generate_secret()
    current_user.update(totp_secret=secret)
    return TotpSetupResponse(
        secret=secret,
        uri=totp_service.provisioning_uri(secret, current_user.email),
    )


def enable_totp(code: str, current_user: User) -> UserResponse:
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inicie o setup primeiro em /auth/2fa/setup",
        )
    if not totp_service.verify_code(current_user.totp_secret, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido"
        )

    current_user.update(totp_enabled=True)
    current_user.reload()
    return user_to_response(current_user)


def disable_totp(code: str, current_user: User) -> UserResponse:
    if not current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="2FA não está ativado"
        )
    if not totp_service.verify_code(current_user.totp_secret, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido"
        )

    current_user.update(totp_enabled=False, totp_secret=None)
    current_user.reload()
    return user_to_response(current_user)
