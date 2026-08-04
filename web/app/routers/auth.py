from fastapi import APIRouter, BackgroundTasks, Depends, Request

from app.dependencies import get_current_user
from app.models.user import User
from app.rate_limit import limiter
from app.services.platform_settings_service import get_settings as get_platform_settings
from app.schemas.auth import TotpConfirm, TotpDisable, TotpSetupResponse, TwoFactorComplete
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
    resend_verification,
    revoke_refresh_token,
    setup_totp,
    user_to_response,
    verify_email_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit(lambda: f"{get_platform_settings().register_rate_limit_per_minute}/minute")
def register(request: Request, data: UserCreate, background_tasks: BackgroundTasks):
    return register_user(data, background_tasks)


@router.post("/login", response_model=LoginResponse)
@limiter.limit(lambda: f"{get_platform_settings().login_rate_limit_per_minute}/minute")
def login(request: Request, data: UserLogin):
    return login_user(data)


@router.post("/login/complete-2fa", response_model=TokenResponse)
@limiter.limit("5/minute")
def login_complete_2fa(request: Request, data: TwoFactorComplete):
    return complete_2fa(data.temp_token, data.code, data.trust_device)


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("10/minute")
def refresh(request: Request, data: RefreshTokenRequest):
    return refresh_tokens(data.refresh_token)


@router.post("/logout")
def logout(data: RefreshTokenRequest, current_user: User = Depends(get_current_user)):
    return revoke_refresh_token(current_user, data.refresh_token)


@router.get("/verify-email", response_model=UserResponse)
def verify_email(token: str):
    return verify_email_token(token)


@router.post("/resend-verification")
@limiter.limit("3/minute")
def resend_email(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    return resend_verification(current_user, background_tasks)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return user_to_response(current_user)


# ── 2FA / TOTP ────────────────────────────────────────────────────────────────

@router.post("/2fa/setup", response_model=TotpSetupResponse)
def totp_setup(current_user: User = Depends(get_current_user)):
    return setup_totp(current_user)


@router.post("/2fa/enable", response_model=UserResponse)
def totp_enable(data: TotpConfirm, current_user: User = Depends(get_current_user)):
    return enable_totp(data.code, current_user)


@router.post("/2fa/disable", response_model=UserResponse)
def totp_disable(data: TotpDisable, current_user: User = Depends(get_current_user)):
    return disable_totp(data.code, current_user)
