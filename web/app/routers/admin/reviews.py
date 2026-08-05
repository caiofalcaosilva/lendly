from fastapi import APIRouter, Depends

from app.dependencies import get_current_admin
from app.models.user import User
from app.services import admin_review_service

router = APIRouter(prefix="/reviews")


@router.delete("/{review_id}", status_code=204)
def admin_delete_review(review_id: str, admin: User = Depends(get_current_admin)):
    """Admin — deletes a review and recalculates the reviewed user's
    rating."""
    admin_review_service.admin_delete_review(review_id)
