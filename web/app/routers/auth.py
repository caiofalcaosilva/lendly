from fastapi import APIRouter, BackgroundTasks, Depends, Request

from app.dependencies import get_current_user
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.auth import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TotpConfirm,
    TotpDisable,
    TotpSetupResponse,
    TwoFactorComplete,
)
from app.schemas.user import (
    LoginResponse,
    RefreshResponse,
    RefreshTokenRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services.auth_service import (
    complete_2fa,
    disable_totp,
    enable_totp,
    login_user,
    refresh_tokens,
    register_user,
    request_password_reset,
    resend_verification,
    reset_password,
    revoke_refresh_token,
    setup_totp,
    user_to_response,
    verify_email_token,
)
from app.services.platform_settings_service import get_settings as get_platform_settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit(
    lambda: f"{get_platform_settings().register_rate_limit_per_minute}/minute"
)
def register(request: Request, data: UserCreate, background_tasks: BackgroundTasks):
    """Creates an account and sends a verification email. Returns tokens
    right away, but most endpoints stay off-limits until is_verified."""
    return register_user(data, background_tasks, request)


@router.post("/login", response_model=LoginResponse)
@limiter.limit(lambda: f"{get_platform_settings().login_rate_limit_per_minute}/minute")
def login(request: Request, data: UserLogin, background_tasks: BackgroundTasks):
    """Password login. If 2FA is enabled and the device isn't trusted,
    returns requires_2fa=True with a temp_token instead of real tokens."""
    return login_user(data, request, background_tasks)


@router.post("/login/complete-2fa", response_model=TokenResponse)
@limiter.limit(
    lambda: f"{get_platform_settings().complete_2fa_rate_limit_per_minute}/minute"
)
def login_complete_2fa(
    request: Request, data: TwoFactorComplete, background_tasks: BackgroundTasks
):
    """Finishes a login that returned requires_2fa=True — exchanges the
    temp_token + TOTP code for real access/refresh tokens."""
    return complete_2fa(
        data.temp_token, data.code, data.trust_device, request, background_tasks
    )


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit(
    lambda: f"{get_platform_settings().refresh_rate_limit_per_minute}/minute"
)
def refresh(request: Request, data: RefreshTokenRequest):
    """Exchanges a refresh token for a new access/refresh pair, rotating
    the old one out of the user's stored sessions."""
    return refresh_tokens(data.refresh_token, request)


@router.post("/logout")
def logout(data: RefreshTokenRequest, current_user: User = Depends(get_current_user)):
    """Revokes one refresh session (this device only) — other logged-in
    devices are unaffected."""
    return revoke_refresh_token(current_user, data.refresh_token)


@router.get("/verify-email", response_model=UserResponse)
def verify_email(token: str):
    """Confirms the token sent by email and flips is_verified — the link
    the user clicks from their inbox."""
    return verify_email_token(token)


@router.post("/resend-verification")
@limiter.limit(
    lambda: (
        f"{get_platform_settings().resend_verification_rate_limit_per_minute}/minute"
    )
)
def resend_email(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Re-sends the verification email with a fresh token, for when the
    original one expired or got lost."""
    return resend_verification(current_user, background_tasks)


@router.post("/forgot-password")
@limiter.limit(
    lambda: f"{get_platform_settings().password_reset_rate_limit_per_minute}/minute"
)
def forgot_password(
    request: Request, data: ForgotPasswordRequest, background_tasks: BackgroundTasks
):
    """Sends a password reset link if the email is registered — responds
    the same either way, so this can't be used to check which emails have
    an account."""
    return request_password_reset(data, background_tasks)


@router.post("/reset-password")
def reset_password_route(data: ResetPasswordRequest):
    """Sets a new password from a valid, unexpired reset token, and revokes
    every existing session."""
    return reset_password(data)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """The logged-in user's own profile."""
    return user_to_response(current_user)


# ── 2FA / TOTP ────────────────────────────────────────────────────────────────


@router.post("/2fa/setup", response_model=TotpSetupResponse)
def totp_setup(current_user: User = Depends(get_current_user)):
    """Generates a new TOTP secret + QR code — call totp/enable with a
    valid code from it to actually turn 2FA on."""
    return setup_totp(current_user)


@router.post("/2fa/enable", response_model=UserResponse)
def totp_enable(data: TotpConfirm, current_user: User = Depends(get_current_user)):
    """Confirms a TOTP code against the pending secret from totp/setup and
    turns 2FA on."""
    return enable_totp(data.code, current_user)


@router.post("/2fa/disable", response_model=UserResponse)
def totp_disable(data: TotpDisable, current_user: User = Depends(get_current_user)):
    """Turns 2FA off — requires a valid current TOTP code, not just the
    access token, so a stolen session alone can't disable it."""
    return disable_totp(data.code, current_user)
