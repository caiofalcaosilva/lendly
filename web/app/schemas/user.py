from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


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


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    device_token: Optional[str] = None


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
    average_rating: float
    rating_count: int
    created_at: datetime


class TokenResponse(BaseModel):
    """Returned on successful auth (register or login without 2FA required)."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    device_token: str


class LoginResponse(BaseModel):
    """Returned by POST /auth/login. May require 2FA."""
    requires_2fa: bool = False
    temp_token: Optional[str] = None
    # Populated when requires_2fa is False
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserResponse] = None
    device_token: Optional[str] = None
