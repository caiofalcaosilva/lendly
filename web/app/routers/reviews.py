from typing import List

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse
from app.services import review_service

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/request/{request_id}", response_model=ReviewResponse, status_code=201)
def create_review(
    request_id: str, data: ReviewCreate, current_user: User = Depends(get_current_user)
):
    return review_service.create_review(request_id, data, current_user)


@router.get("/user/{user_id}", response_model=List[ReviewResponse])
def get_user_reviews(user_id: str):
    return review_service.get_user_reviews(user_id)
