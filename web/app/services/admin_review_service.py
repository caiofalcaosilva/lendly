from app.models.review import Review
from app.models.user import User
from app.services import activity_service
from app.services.review_service import recalculate_rating
from app.utils import errors


def admin_delete_review(review_id: str, admin: User) -> None:
    review = Review.objects(id=review_id).first()
    if not review:
        raise errors.not_found("Review not found")
    reviewer = review.reviewer
    reviewed = review.reviewed
    item_title = review.loan_request.item.title
    review.delete()
    recalculate_rating(reviewed)
    for recipient in (reviewer, reviewed):
        activity_service.record(
            recipient=recipient,
            event="admin.review_deleted",
            actor=admin,
            resource_type="review",
            resource_id=review_id,
            resource_title=item_title,
        )
