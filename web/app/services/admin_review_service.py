from app.models.review import Review
from app.services.review_service import recalculate_rating
from app.utils import errors


def admin_delete_review(review_id: str) -> None:
    review = Review.objects(id=review_id).first()
    if not review:
        raise errors.not_found("Review not found")
    reviewed = review.reviewed
    review.delete()
    recalculate_rating(reviewed)
