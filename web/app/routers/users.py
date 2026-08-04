from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.dependencies import get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.analytics import OwnerAnalyticsSummary
from app.schemas.item import ItemResponse
from app.schemas.loan_request import LoanRequestResponse
from app.schemas.payment import MercadoPagoCallback, MercadoPagoConnectResponse, MercadoPagoConnectStatus
from app.schemas.user import AccountDeleteRequest, BusinessSummary, UserResponse, UserUpdate
from app.services import analytics_service, export_service, item_service, loan_request_service, mp_connect_service
from app.services.auth_service import delete_account, user_to_response

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    current_user.reload()
    return user_to_response(current_user)


@router.put("/me", response_model=UserResponse)
def update_profile(data: UserUpdate, current_user: User = Depends(get_current_user)):
    updates = data.model_dump(exclude_none=True)
    if updates:
        updates["updated_at"] = datetime.utcnow()
        current_user.update(**updates)
        current_user.reload()
    return user_to_response(current_user)


@router.get("/me/items", response_model=List[ItemResponse])
def my_items(current_user: User = Depends(get_current_user)):
    return item_service.get_user_items(str(current_user.id), current_user)


@router.get("/me/favorites", response_model=List[ItemResponse])
def my_favorites(current_user: User = Depends(get_current_user)):
    return item_service.get_favorite_items(current_user)


@router.get("/me/requests/sent", response_model=List[LoanRequestResponse])
def sent_requests(current_user: User = Depends(get_current_user)):
    return loan_request_service.get_sent_requests(current_user)


@router.get("/me/requests/received", response_model=List[LoanRequestResponse])
def received_requests(current_user: User = Depends(get_current_user)):
    return loan_request_service.get_received_requests(current_user)


@router.get("/me/history", response_model=List[LoanRequestResponse])
def my_history(current_user: User = Depends(get_current_user)):
    return loan_request_service.get_history(current_user)


@router.get("/me/analytics", response_model=OwnerAnalyticsSummary)
def my_analytics(current_user: User = Depends(get_current_user)):
    return analytics_service.get_owner_analytics(current_user)


@router.get("/me/export")
def export_my_data(response: Response, current_user: User = Depends(get_current_user)):
    response.headers["Content-Disposition"] = (
        f'attachment; filename="lendly-dados-{current_user.id}.json"'
    )
    return export_service.export_user_data(current_user)


@router.delete("/me", status_code=204)
def delete_my_account(data: AccountDeleteRequest, current_user: User = Depends(get_current_user)):
    delete_account(data, current_user)


@router.get("/me/mercadopago/connect", response_model=MercadoPagoConnectResponse)
def mercadopago_connect(current_user: User = Depends(get_current_user)):
    return mp_connect_service.get_connect_url(current_user)


@router.post("/me/mercadopago/callback", response_model=MercadoPagoConnectStatus)
def mercadopago_callback(data: MercadoPagoCallback, current_user: User = Depends(get_current_user)):
    return mp_connect_service.handle_callback(data.code, data.state, current_user)


@router.get("/me/mercadopago/status", response_model=MercadoPagoConnectStatus)
def mercadopago_status(current_user: User = Depends(get_current_user)):
    return mp_connect_service.get_connect_status(current_user)


@router.get("/businesses", response_model=List[BusinessSummary])
def list_businesses():
    # Registered before /{user_id} so "businesses" isn't swallowed as a path param.
    users = User.objects(account_type="business", is_active=True, is_admin__ne=True).order_by("company_name")
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


@router.get("/{user_id}/items", response_model=List[ItemResponse])
def get_user_items_public(
    user_id: str, current_user: Optional[User] = Depends(get_current_user_optional)
):
    # Admin accounts are treated as if they don't exist to other users —
    # 404, not 403, so their existence isn't leaked either.
    user = User.objects(id=user_id, is_active=True, is_admin__ne=True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return item_service.get_user_items(user_id, current_user)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str):
    user = User.objects(id=user_id, is_active=True, is_admin__ne=True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user_to_response(user)
