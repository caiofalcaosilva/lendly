from fastapi import HTTPException, status

from app.models.review import Review
from app.services.review_service import recalculate_rating


def admin_delete_review(review_id: str) -> None:
    review = Review.objects(id=review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    reviewed = review.reviewed
    review.delete()
    recalculate_rating(reviewed)
