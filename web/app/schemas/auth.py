from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class TwoFactorComplete(BaseModel):
    temp_token: str
    code: str
    trust_device: bool = True


class TotpSetupResponse(BaseModel):
    secret: str
    uri: str


class TotpConfirm(BaseModel):
    code: str


class TotpDisable(BaseModel):
    code: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


class GoogleCallbackRequest(BaseModel):
    code: str
    state: str
    device_token: str | None = None


class GoogleConnectResponse(BaseModel):
    authorization_url: str


class GoogleConnectStatus(BaseModel):
    connected: bool
    connected_at: datetime | None = None


class GoogleConnectCallback(BaseModel):
    code: str
    state: str
