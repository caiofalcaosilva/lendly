from typing import List

from fastapi import HTTPException, status

from app.models.loan_request import LoanRequest
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse


def _to_response(review: Review) -> ReviewResponse:
    req = review.loan_request
    reviewed_role = "owner" if str(review.reviewed.id) == str(req.owner.id) else "requester"
    return ReviewResponse(
        id=str(review.id),
        loan_request_id=str(req.id),
        item_id=str(req.item.id),
        item_title=req.item.title,
        reviewer_id=str(review.reviewer.id),
        reviewer_name=review.reviewer.name,
        reviewed_id=str(review.reviewed.id),
        reviewed_name=review.reviewed.name,
        reviewed_role=reviewed_role,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
    )


def _recalculate_rating(user: User) -> None:
    reviews = list(Review.objects(reviewed=user))
    if not reviews:
        return
    avg = sum(r.rating for r in reviews) / len(reviews)
    user.update(average_rating=round(avg, 2), rating_count=len(reviews))


def create_review(request_id: str, data: ReviewCreate, current_user: User) -> ReviewResponse:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    is_requester = str(req.requester.id) == str(current_user.id)
    is_owner = str(req.owner.id) == str(current_user.id)

    if not is_requester and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if req.status != "finished":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviews are only allowed for finished requests",
        )

    if Review.objects(loan_request=req, reviewer=current_user).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already reviewed this request",
        )

    reviewed = req.owner if is_requester else req.requester

    review = Review(
        loan_request=req,
        reviewer=current_user,
        reviewed=reviewed,
        rating=data.rating,
        comment=data.comment,
    )
    review.save()
    _recalculate_rating(reviewed)

    return _to_response(review)


def get_user_reviews(user_id: str) -> List[ReviewResponse]:
    user = User.objects(id=user_id, is_active=True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return [_to_response(r) for r in Review.objects(reviewed=user).order_by("-created_at")]
