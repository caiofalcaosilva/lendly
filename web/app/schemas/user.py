from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.utils.validators import is_valid_cnpj


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    phone: Optional[str] = Field(None, max_length=20)
    zip_code: Optional[str] = Field(None, max_length=10)
    street: Optional[str] = Field(None, max_length=200)
    number: Optional[str] = Field(None, max_length=20)
    complement: Optional[str] = Field(None, max_length=100)
    neighborhood: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=2)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    account_type: str = Field("individual", pattern="^(individual|business)$")
    company_name: Optional[str] = Field(None, max_length=150)
    trade_name: Optional[str] = Field(None, max_length=150)
    cnpj: Optional[str] = Field(None, max_length=18)
    business_category: Optional[str] = Field(None, max_length=100)
    business_phone: Optional[str] = Field(None, max_length=20)
    business_hours: Optional[str] = Field(None, max_length=200)
    website: Optional[str] = Field(None, max_length=200)

    @model_validator(mode="after")
    def _validate_business_fields(self):
        if self.account_type == "business":
            if not self.company_name:
                raise ValueError("company_name is required for business accounts")
            if not self.cnpj or not is_valid_cnpj(self.cnpj):
                raise ValueError("A valid cnpj is required for business accounts")
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    device_token: Optional[str] = None


class AccountDeleteRequest(BaseModel):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    zip_code: Optional[str] = Field(None, max_length=10)
    street: Optional[str] = Field(None, max_length=200)
    number: Optional[str] = Field(None, max_length=20)
    complement: Optional[str] = Field(None, max_length=100)
    neighborhood: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=2)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    company_name: Optional[str] = Field(None, max_length=150)
    trade_name: Optional[str] = Field(None, max_length=150)
    cnpj: Optional[str] = Field(None, max_length=18)
    business_category: Optional[str] = Field(None, max_length=100)
    business_phone: Optional[str] = Field(None, max_length=20)
    business_hours: Optional[str] = Field(None, max_length=200)
    website: Optional[str] = Field(None, max_length=200)

    @model_validator(mode="after")
    def _validate_cnpj(self):
        if self.cnpj and not is_valid_cnpj(self.cnpj):
            raise ValueError("Invalid cnpj")
        return self


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    zip_code: Optional[str] = None
    street: Optional[str] = None
    number: Optional[str] = None
    complement: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_verified: bool = False
    totp_enabled: bool = False
    is_admin: bool = False
    cpf: Optional[str] = None
    identity_status: str = "none"
    average_rating: float
    rating_count: int
    reliability_score: Optional[float] = None
    reliability_count: int = 0
    on_time_rate: Optional[float] = None
    finished_loans_count: int = 0
    account_type: str = "individual"
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
    cnpj: Optional[str] = None
    business_category: Optional[str] = None
    business_phone: Optional[str] = None
    business_hours: Optional[str] = None
    website: Optional[str] = None
    created_at: datetime


class BusinessSummary(BaseModel):
    id: str
    name: str
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
    business_category: Optional[str] = None
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    average_rating: float
    reliability_score: Optional[float] = None
    reliability_count: int = 0


class TokenResponse(BaseModel):
    """Returned on successful auth (register or login without 2FA required)."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    device_token: str


class LoginResponse(BaseModel):
    """Returned by POST /auth/login. May require 2FA."""
    requires_2fa: bool = False
    temp_token: Optional[str] = None
    # Populated when requires_2fa is False
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserResponse] = None
    device_token: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
