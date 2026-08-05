"""Split by responsibility across this package's modules (registration,
session, totp, account) — re-exported here so callers keep using
`auth_service.login_user` / `from app.services.auth_service import X`
exactly as before the split."""

from app.services.auth_service._common import user_to_response
from app.services.auth_service.account import delete_account
from app.services.auth_service.registration import (
    register_user,
    resend_verification,
    verify_email_token,
)
from app.services.auth_service.session import (
    complete_2fa,
    login_user,
    refresh_tokens,
    revoke_refresh_token,
)
from app.services.auth_service.totp import disable_totp, enable_totp, setup_totp

__all__ = [
    "complete_2fa",
    "delete_account",
    "disable_totp",
    "enable_totp",
    "login_user",
    "refresh_tokens",
    "register_user",
    "resend_verification",
    "revoke_refresh_token",
    "setup_totp",
    "user_to_response",
    "verify_email_token",
]
