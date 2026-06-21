from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.item import ItemResponse
from app.schemas.loan_request import LoanRequestResponse
from app.schemas.user import UserResponse, UserUpdate
from app.services import item_service, loan_request_service
from app.services.auth_service import user_to_response

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
    return item_service.get_user_items(str(current_user.id))


@router.get("/me/requests/sent", response_model=List[LoanRequestResponse])
def sent_requests(current_user: User = Depends(get_current_user)):
    return loan_request_service.get_sent_requests(current_user)


@router.get("/me/requests/received", response_model=List[LoanRequestResponse])
def received_requests(current_user: User = Depends(get_current_user)):
    return loan_request_service.get_received_requests(current_user)


@router.get("/me/history", response_model=List[LoanRequestResponse])
def my_history(current_user: User = Depends(get_current_user)):
    return loan_request_service.get_history(current_user)


@router.get("/{user_id}/items", response_model=List[ItemResponse])
def get_user_items_public(user_id: str):
    user = User.objects(id=user_id, is_active=True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return item_service.get_user_items(user_id)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str):
    user = User.objects(id=user_id, is_active=True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user_to_response(user)
