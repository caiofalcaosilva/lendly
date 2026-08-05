"""Split by responsibility across this package's modules (registration,
session, totp, account, password_reset) — re-exported here so callers keep
using `auth_service.login_user` / `from app.services.auth_service import X`
exactly as before the split."""

from app.services.auth_service._common import user_to_public_response, user_to_response
from app.services.auth_service.account import (
    change_email,
    change_password,
    delete_account,
    pause_account,
    resume_account,
)
from app.services.auth_service.password_reset import (
    request_password_reset,
    reset_password,
)
from app.services.auth_service.registration import (
    register_user,
    resend_verification,
    verify_email_token,
)
from app.services.auth_service.session import (
    complete_2fa,
    get_login_history,
    get_sessions,
    login_user,
    refresh_tokens,
    revoke_refresh_token,
    revoke_session,
)
from app.services.auth_service.totp import disable_totp, enable_totp, setup_totp

__all__ = [
    "change_email",
    "change_password",
    "complete_2fa",
    "delete_account",
    "disable_totp",
    "enable_totp",
    "get_login_history",
    "get_sessions",
    "login_user",
    "pause_account",
    "refresh_tokens",
    "register_user",
    "request_password_reset",
    "resend_verification",
    "reset_password",
    "resume_account",
    "revoke_refresh_token",
    "revoke_session",
    "setup_totp",
    "user_to_public_response",
    "user_to_response",
    "verify_email_token",
]
