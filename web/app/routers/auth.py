from fastapi import APIRouter, BackgroundTasks, Depends

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import TotpConfirm, TotpDisable, TotpSetupResponse, TwoFactorComplete
from app.schemas.user import LoginResponse, TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import (
    complete_2fa,
    disable_totp,
    enable_totp,
    login_user,
    register_user,
    resend_verification,
    setup_totp,
    user_to_response,
    verify_email_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserCreate, background_tasks: BackgroundTasks):
    return register_user(data, background_tasks)


@router.post("/login", response_model=LoginResponse)
def login(data: UserLogin):
    return login_user(data)


@router.post("/login/complete-2fa", response_model=TokenResponse)
def login_complete_2fa(data: TwoFactorComplete):
    return complete_2fa(data.temp_token, data.code, data.trust_device)


@router.get("/verify-email", response_model=UserResponse)
def verify_email(token: str):
    return verify_email_token(token)


@router.post("/resend-verification")
def resend_email(background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
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
