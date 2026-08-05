from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.utils.validators import is_valid_cnpj


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    phone: str | None = Field(None, max_length=20)
    zip_code: str | None = Field(None, max_length=10)
    street: str | None = Field(None, max_length=200)
    number: str | None = Field(None, max_length=20)
    complement: str | None = Field(None, max_length=100)
    neighborhood: str | None = Field(None, max_length=100)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=2)
    latitude: float | None = None
    longitude: float | None = None
    account_type: str = Field("individual", pattern="^(individual|business)$")
    company_name: str | None = Field(None, max_length=150)
    trade_name: str | None = Field(None, max_length=150)
    cnpj: str | None = Field(None, max_length=18)
    business_category: str | None = Field(None, max_length=100)
    business_phone: str | None = Field(None, max_length=20)
    business_hours: str | None = Field(None, max_length=200)
    website: str | None = Field(None, max_length=200)
    instagram: str | None = Field(None, max_length=100)
    whatsapp: str | None = Field(None, max_length=20)

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
    device_token: str | None = None


class AccountDeleteRequest(BaseModel):
    password: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class EmailChangeRequest(BaseModel):
    new_email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    bio: str | None = Field(None, max_length=500)
    phone: str | None = Field(None, max_length=20)
    zip_code: str | None = Field(None, max_length=10)
    street: str | None = Field(None, max_length=200)
    number: str | None = Field(None, max_length=20)
    complement: str | None = Field(None, max_length=100)
    neighborhood: str | None = Field(None, max_length=100)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=2)
    latitude: float | None = None
    longitude: float | None = None
    company_name: str | None = Field(None, max_length=150)
    trade_name: str | None = Field(None, max_length=150)
    cnpj: str | None = Field(None, max_length=18)
    business_category: str | None = Field(None, max_length=100)
    business_phone: str | None = Field(None, max_length=20)
    business_hours: str | None = Field(None, max_length=200)
    website: str | None = Field(None, max_length=200)
    instagram: str | None = Field(None, max_length=100)
    whatsapp: str | None = Field(None, max_length=20)

    @model_validator(mode="after")
    def _validate_cnpj(self):
        if self.cnpj and not is_valid_cnpj(self.cnpj):
            raise ValueError("Invalid cnpj")
        return self


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: str | None = None
    bio: str | None = None
    phone: str | None = None
    zip_code: str | None = None
    street: str | None = None
    number: str | None = None
    complement: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_verified: bool = False
    totp_enabled: bool = False
    is_admin: bool = False
    cpf: str | None = None
    identity_status: str = "none"
    average_rating: float
    rating_count: int
    reliability_score: float | None = None
    reliability_count: int = 0
    on_time_rate: float | None = None
    finished_loans_count: int = 0
    account_type: str = "individual"
    company_name: str | None = None
    trade_name: str | None = None
    cnpj: str | None = None
    business_category: str | None = None
    business_phone: str | None = None
    business_hours: str | None = None
    website: str | None = None
    instagram: str | None = None
    whatsapp: str | None = None
    featured_item_ids: list[str] = []
    created_at: datetime


class SessionSummary(BaseModel):
    # The refresh token's hash — irreversible, but stable and unique per
    # session, so it doubles as a safe-to-expose identifier for revocation.
    id: str
    created_at: datetime
    expires_at: datetime
    ip_address: str | None = None
    user_agent: str | None = None


class LoginHistoryEntry(BaseModel):
    created_at: datetime
    ip_address: str | None = None
    user_agent: str | None = None
    revoked: bool


class FeaturedItemsUpdate(BaseModel):
    item_ids: list[str] = Field(..., max_length=3)


class PublicUserResponse(BaseModel):
    """What `GET /users/{user_id}` returns — deliberately narrower than
    UserResponse. No email, cpf, phone, address detail, is_admin,
    totp_enabled or identity_status: none of that is rendered by the public
    profile page, and returning it just because UserResponse already had the
    field was a real PII leak (see roadmap)."""

    id: str
    name: str
    avatar_url: str | None = None
    bio: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    average_rating: float
    rating_count: int
    reliability_score: float | None = None
    reliability_count: int = 0
    on_time_rate: float | None = None
    finished_loans_count: int = 0
    account_type: str = "individual"
    trade_name: str | None = None
    business_category: str | None = None
    business_phone: str | None = None
    business_hours: str | None = None
    website: str | None = None
    instagram: str | None = None
    whatsapp: str | None = None
    featured_item_ids: list[str] = []
    is_favorited: bool = False
    created_at: datetime


class FavoriteUserSummary(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    trade_name: str | None = None
    account_type: str = "individual"
    business_category: str | None = None
    city: str | None = None
    neighborhood: str | None = None
    average_rating: float
    reliability_score: float | None = None
    reliability_count: int = 0


class BusinessSummary(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    company_name: str | None = None
    trade_name: str | None = None
    business_category: str | None = None
    city: str | None = None
    neighborhood: str | None = None
    average_rating: float
    reliability_score: float | None = None
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
    temp_token: str | None = None
    # Populated when requires_2fa is False
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    user: UserResponse | None = None
    device_token: str | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
