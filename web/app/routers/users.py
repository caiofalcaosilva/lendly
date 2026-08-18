from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, UploadFile

from app.dependencies import get_current_user, get_current_user_optional
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.analytics import OwnerAnalyticsSummary, RequesterSpendingSummary
from app.schemas.auth import (
    GoogleConnectCallback,
    GoogleConnectResponse,
    GoogleConnectStatus,
)
from app.schemas.item import ItemResponse
from app.schemas.loan_request import LoanRequestResponse
from app.schemas.payment import (
    MercadoPagoCallback,
    MercadoPagoConnectResponse,
    MercadoPagoConnectStatus,
)
from app.schemas.user import (
    AccountDeleteRequest,
    BusinessSummary,
    EmailChangeRequest,
    FavoriteUserSummary,
    FeaturedItemsUpdate,
    LoginHistoryEntry,
    NotificationPreferencesUpdate,
    PasswordChangeRequest,
    PhoneVerificationSendResponse,
    PhoneVerifyRequest,
    PublicUserResponse,
    SessionSummary,
    UserResponse,
    UserUpdate,
)
from app.services import (
    analytics_service,
    avatar_service,
    export_service,
    featured_items_service,
    google_connect_service,
    item_service,
    loan_request_service,
    mp_connect_service,
    notification_prefs_service,
    phone_verification_service,
    user_favorites_service,
)
from app.services.auth_service import (
    change_email,
    change_password,
    delete_account,
    get_login_history,
    get_sessions,
    pause_account,
    resume_account,
    revoke_session,
    user_to_public_response,
    user_to_response,
)
from app.services.platform_settings_service import get_settings as get_platform_settings
from app.utils import errors
from app.utils.time import utcnow
from app.utils.validators import normalize_digits

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """The logged-in user's own profile."""
    current_user.reload()
    return user_to_response(current_user)


_BUSINESS_PROFILE_FIELDS = {
    "company_name",
    "trade_name",
    "cnpj",
    "business_category",
    "business_phone",
    "business_hours",
    "website",
    "instagram",
    "whatsapp",
}


@router.put("/me", response_model=UserResponse)
def update_profile(data: UserUpdate, current_user: User = Depends(get_current_user)):
    """Partial update of the logged-in user's profile — only fields present
    in the payload are changed."""
    updates = data.model_dump(exclude_none=True)
    if updates:
        for field in ("phone", "business_phone", "whatsapp", "cnpj"):
            if updates.get(field):
                updates[field] = normalize_digits(updates[field])
        # A new phone number hasn't been confirmed yet — never let it
        # inherit the verified badge (or a code in flight) from whatever
        # number was there before.
        if "phone" in updates and updates["phone"] != current_user.phone:
            updates["phone_verified"] = False
            current_user.update(unset__phone_verification=1)
        business_updates = {
            k: updates.pop(k) for k in list(updates) if k in _BUSINESS_PROFILE_FIELDS
        }
        if business_updates:
            current_user.update(
                **{
                    f"set__business_profile__{k}": v
                    for k, v in business_updates.items()
                }
            )
        updates["updated_at"] = utcnow()
        current_user.update(**updates)
        current_user.reload()
    return user_to_response(current_user)


@router.put("/me/password", response_model=UserResponse)
def update_password(
    data: PasswordChangeRequest, current_user: User = Depends(get_current_user)
):
    """Changes the logged-in user's password — requires the current one.
    Revokes every refresh session, forcing re-login on other devices."""
    return change_password(data, current_user)


@router.put("/me/email", response_model=UserResponse)
def update_email(
    data: EmailChangeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Changes the logged-in user's email — requires the current password.
    Flips is_verified back to false and sends a fresh verification link."""
    return change_email(data, current_user, background_tasks)


@router.get("/me/sessions", response_model=list[SessionSummary])
def my_sessions(current_user: User = Depends(get_current_user)):
    """Every device/session currently able to refresh the logged-in user's
    access token."""
    return get_sessions(current_user)


@router.delete("/me/sessions/{session_id}")
def revoke_my_session(session_id: str, current_user: User = Depends(get_current_user)):
    """Revokes one session by id — that device gets logged out next time its
    access token expires and it tries to refresh."""
    return revoke_session(session_id, current_user)


@router.put("/me/notification-preferences", response_model=UserResponse)
def update_notification_preferences(
    data: NotificationPreferencesUpdate, current_user: User = Depends(get_current_user)
):
    """Toggles which convenience emails the logged-in user gets (status
    changes, chat messages, verification results, item back in stock).
    Security emails aren't covered — those never stop."""
    return notification_prefs_service.update_notification_prefs(data, current_user)


@router.get("/me/login-history", response_model=list[LoginHistoryEntry])
def my_login_history(current_user: User = Depends(get_current_user)):
    """Passive log of past logins (date, IP, device) — read-only, for
    spotting suspicious activity. See /me/sessions to actually revoke one."""
    return get_login_history(current_user)


@router.post("/me/avatar", response_model=UserResponse, status_code=201)
async def upload_avatar(
    file: UploadFile, current_user: User = Depends(get_current_user)
):
    """Uploads a profile photo for the logged-in user — resized and
    replaces any existing avatar."""
    return await avatar_service.upload_avatar(file, current_user)


@router.delete("/me/avatar", response_model=UserResponse)
def remove_avatar(current_user: User = Depends(get_current_user)):
    """Removes the logged-in user's profile photo — falls back to initials
    in the UI."""
    return avatar_service.remove_avatar(current_user)


@router.put("/me/featured-items", response_model=UserResponse)
def set_featured_items(
    data: FeaturedItemsUpdate, current_user: User = Depends(get_current_user)
):
    """Sets up to 3 of the logged-in user's own active items to pin at the
    top of their public profile — replaces the previous selection."""
    return featured_items_service.set_featured_items(data.item_ids, current_user)


@router.get("/me/items", response_model=list[ItemResponse])
def my_items(current_user: User = Depends(get_current_user)):
    """Every item the logged-in user owns, including inactive ones."""
    return item_service.get_user_items(str(current_user.id), current_user)


@router.get("/me/favorites", response_model=list[ItemResponse])
def my_favorites(
    skip: int = 0, limit: int = 50, current_user: User = Depends(get_current_user)
):
    """Items the logged-in user has favorited."""
    return item_service.get_favorite_items(current_user, skip, limit)


@router.get("/me/requests/sent", response_model=list[LoanRequestResponse])
def sent_requests(current_user: User = Depends(get_current_user)):
    """Loan requests the logged-in user has sent as requester."""
    return loan_request_service.get_sent_requests(current_user)


@router.get("/me/requests/received", response_model=list[LoanRequestResponse])
def received_requests(current_user: User = Depends(get_current_user)):
    """Loan requests other users have sent for items the logged-in user
    owns."""
    return loan_request_service.get_received_requests(current_user)


@router.get("/me/history", response_model=list[LoanRequestResponse])
def my_history(current_user: User = Depends(get_current_user)):
    """Every finished/cancelled/refused loan request involving the
    logged-in user, either side."""
    return loan_request_service.get_history(current_user)


@router.get("/me/analytics", response_model=OwnerAnalyticsSummary)
def my_analytics(current_user: User = Depends(get_current_user)):
    """Per-item and aggregate stats (times borrowed, revenue, occupancy
    rate) for everything the logged-in user owns."""
    return analytics_service.get_owner_analytics(current_user)


@router.get("/me/spending", response_model=RequesterSpendingSummary)
def my_spending(current_user: User = Depends(get_current_user)):
    """How much the logged-in user has spent renting other people's items —
    the requester-side counterpart to /me/analytics."""
    return analytics_service.get_requester_spending(current_user)


@router.get("/me/export")
def export_my_data(response: Response, current_user: User = Depends(get_current_user)):
    """Downloads every piece of data Lendly holds on the logged-in user, as
    JSON (LGPD data-portability request)."""
    response.headers["Content-Disposition"] = (
        f'attachment; filename="lendly-dados-{current_user.id}.json"'
    )
    return export_service.export_user_data(current_user)


@router.delete("/me", status_code=204)
def delete_my_account(
    data: AccountDeleteRequest, current_user: User = Depends(get_current_user)
):
    """Anonymizes and deactivates the logged-in user's account — requires
    the current password as confirmation."""
    delete_account(data, current_user)


@router.post("/me/pause", response_model=UserResponse)
def pause_my_account(current_user: User = Depends(get_current_user)):
    """Hides all of the logged-in user's active items from search and blocks
    new requests on them — reversible any time via /me/resume, unlike
    account deletion."""
    return pause_account(current_user)


@router.post("/me/resume", response_model=UserResponse)
def resume_my_account(current_user: User = Depends(get_current_user)):
    """Reverses /me/pause — reactivates exactly the items that pausing had
    turned off."""
    return resume_account(current_user)


@router.get("/me/mercadopago/connect", response_model=MercadoPagoConnectResponse)
def mercadopago_connect(current_user: User = Depends(get_current_user)):
    """Starts the OAuth flow to link the logged-in user's own Mercado Pago
    account — required before they can list paid items."""
    return mp_connect_service.get_connect_url(current_user)


@router.post("/me/mercadopago/callback", response_model=MercadoPagoConnectStatus)
def mercadopago_callback(
    data: MercadoPagoCallback, current_user: User = Depends(get_current_user)
):
    """Completes the Mercado Pago OAuth flow — exchanges the redirect's
    code + state for a stored access token."""
    return mp_connect_service.handle_callback(data.code, data.state, current_user)


@router.get("/me/mercadopago/status", response_model=MercadoPagoConnectStatus)
def mercadopago_status(current_user: User = Depends(get_current_user)):
    """Whether the logged-in user has a Mercado Pago account connected."""
    return mp_connect_service.get_connect_status(current_user)


@router.get("/me/google/connect", response_model=GoogleConnectResponse)
def google_connect(current_user: User = Depends(get_current_user)):
    """Starts the OAuth flow to link the logged-in user's own Google
    account — for someone who already has a password-based account and
    wants to add "Continuar com Google" as a login option."""
    return google_connect_service.get_connect_url(current_user)


@router.post("/me/google/callback", response_model=GoogleConnectStatus)
def google_connect_callback(
    data: GoogleConnectCallback, current_user: User = Depends(get_current_user)
):
    """Completes the Google OAuth flow — exchanges the redirect's code +
    state for the account's google_id."""
    return google_connect_service.handle_callback(data.code, data.state, current_user)


@router.get("/me/google/status", response_model=GoogleConnectStatus)
def google_status(current_user: User = Depends(get_current_user)):
    """Whether the logged-in user has a Google account connected."""
    return google_connect_service.get_connect_status(current_user)


@router.post("/me/phone/send-code", response_model=PhoneVerificationSendResponse)
@limiter.limit(
    lambda: f"{get_platform_settings().phone_verification_rate_limit_per_minute}/minute"
)
def phone_send_code(request: Request, current_user: User = Depends(get_current_user)):
    """Sends (or re-sends) a 6-digit SMS code to the logged-in user's own
    phone — the one already saved on their profile, not one passed in the
    request."""
    return phone_verification_service.send_code(current_user)


@router.post("/me/phone/verify", response_model=UserResponse)
def phone_verify(
    data: PhoneVerifyRequest, current_user: User = Depends(get_current_user)
):
    """Confirms the code sent by /me/phone/send-code."""
    return phone_verification_service.verify_code(current_user, data.code)


@router.get("/me/favorite-users", response_model=list[FavoriteUserSummary])
def my_favorite_users(
    skip: int = 0, limit: int = 50, current_user: User = Depends(get_current_user)
):
    """Users/businesses the logged-in user has favorited."""
    return user_favorites_service.get_favorite_users(current_user, skip, limit)


@router.get("/businesses", response_model=list[BusinessSummary])
def list_businesses():
    """Public directory of business accounts — no auth, no pagination
    (low volume today)."""
    # Registered before /{user_id} so "businesses" isn't swallowed as a path param.
    users = User.objects(
        account_type="business", is_active=True, is_admin__ne=True
    ).order_by("business_profile.company_name")
    return [
        BusinessSummary(
            id=str(u.id),
            name=u.name,
            avatar_url=u.avatar_url,
            company_name=u.business_profile.company_name
            if u.business_profile
            else None,
            trade_name=u.business_profile.trade_name if u.business_profile else None,
            business_category=(
                u.business_profile.business_category if u.business_profile else None
            ),
            city=u.city,
            neighborhood=u.neighborhood,
            average_rating=u.reputation.average_rating,
            reliability_score=u.reputation.reliability_score,
            reliability_count=u.reputation.reliability_count or 0,
        )
        for u in users
    ]


@router.get("/{user_id}/items", response_model=list[ItemResponse])
def get_user_items_public(
    user_id: str, current_user: User | None = Depends(get_current_user_optional)
):
    """Public listing of another user's items — visible items only, same
    rules as browsing the catalog."""
    # Admin accounts are treated as if they don't exist to other users —
    # 404, not 403, so their existence isn't leaked either.
    user = User.objects(id=user_id, is_active=True, is_admin__ne=True).first()
    if not user:
        raise errors.not_found("User not found")
    return item_service.get_user_items(user_id, current_user)


@router.post("/{user_id}/favorite", response_model=PublicUserResponse)
def favorite_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Adds a user/business to the logged-in user's favorites."""
    return user_favorites_service.set_favorite_user(user_id, current_user, True)


@router.delete("/{user_id}/favorite", response_model=PublicUserResponse)
def unfavorite_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Removes a user/business from the logged-in user's favorites."""
    return user_favorites_service.set_favorite_user(user_id, current_user, False)


@router.get("/{user_id}", response_model=PublicUserResponse)
def get_user(
    user_id: str, current_user: User | None = Depends(get_current_user_optional)
):
    """Public profile of any active, non-admin user — no auth required."""
    user = User.objects(id=user_id, is_active=True, is_admin__ne=True).first()
    if not user:
        raise errors.not_found("User not found")
    return user_to_public_response(user, viewer=current_user)
