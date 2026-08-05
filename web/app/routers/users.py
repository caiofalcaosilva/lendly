from fastapi import APIRouter, Depends, Response

from app.dependencies import get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.analytics import OwnerAnalyticsSummary
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
    PublicUserResponse,
    UserResponse,
    UserUpdate,
)
from app.services import (
    analytics_service,
    export_service,
    item_service,
    loan_request_service,
    mp_connect_service,
)
from app.services.auth_service import (
    delete_account,
    user_to_public_response,
    user_to_response,
)
from app.utils import errors
from app.utils.time import utcnow

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """The logged-in user's own profile."""
    current_user.reload()
    return user_to_response(current_user)


@router.put("/me", response_model=UserResponse)
def update_profile(data: UserUpdate, current_user: User = Depends(get_current_user)):
    """Partial update of the logged-in user's profile — only fields present
    in the payload are changed."""
    updates = data.model_dump(exclude_none=True)
    if updates:
        updates["updated_at"] = utcnow()
        current_user.update(**updates)
        current_user.reload()
    return user_to_response(current_user)


@router.get("/me/items", response_model=list[ItemResponse])
def my_items(current_user: User = Depends(get_current_user)):
    """Every item the logged-in user owns, including inactive ones."""
    return item_service.get_user_items(str(current_user.id), current_user)


@router.get("/me/favorites", response_model=list[ItemResponse])
def my_favorites(current_user: User = Depends(get_current_user)):
    """Items the logged-in user has favorited."""
    return item_service.get_favorite_items(current_user)


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


@router.get("/businesses", response_model=list[BusinessSummary])
def list_businesses():
    """Public directory of business accounts — no auth, no pagination
    (low volume today)."""
    # Registered before /{user_id} so "businesses" isn't swallowed as a path param.
    users = User.objects(
        account_type="business", is_active=True, is_admin__ne=True
    ).order_by("company_name")
    return [
        BusinessSummary(
            id=str(u.id),
            name=u.name,
            company_name=u.company_name,
            trade_name=u.trade_name,
            business_category=u.business_category,
            city=u.city,
            neighborhood=u.neighborhood,
            average_rating=u.average_rating,
            reliability_score=u.reliability_score,
            reliability_count=u.reliability_count or 0,
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


@router.get("/{user_id}", response_model=PublicUserResponse)
def get_user(user_id: str):
    """Public profile of any active, non-admin user — no auth required."""
    user = User.objects(id=user_id, is_active=True, is_admin__ne=True).first()
    if not user:
        raise errors.not_found("User not found")
    return user_to_public_response(user)
