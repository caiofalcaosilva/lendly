from mongoengine import NotUniqueError

from app.models.loan_request import LoanRequest
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse
from app.utils import errors


def _to_response(review: Review) -> ReviewResponse:
    req = review.loan_request
    reviewed_role = (
        "owner" if str(review.reviewed.id) == str(req.owner.id) else "requester"
    )
    return ReviewResponse(
        id=str(review.id),
        loan_request_id=str(req.id),
        item_id=str(req.item.id),
        item_title=req.item.title,
        reviewer_id=str(review.reviewer.id),
        reviewer_name=review.reviewer.name,
        reviewer_avatar_url=review.reviewer.avatar_url,
        reviewed_id=str(review.reviewed.id),
        reviewed_name=review.reviewed.name,
        reviewed_role=reviewed_role,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
    )


def recalculate_rating(user: User) -> None:
    """Also called from admin_review_service after a moderation deletion —
    unlike the only previous caller (create_review), that path can bring
    the review count down to zero, so it's handled explicitly here rather
    than left at whatever average_rating happened to be before."""
    reviews = list(Review.objects(reviewed=user))
    if not reviews:
        user.update(average_rating=0.0, rating_count=0)
        return
    avg = sum(r.rating for r in reviews) / len(reviews)
    user.update(average_rating=round(avg, 2), rating_count=len(reviews))


def create_review(
    request_id: str, data: ReviewCreate, current_user: User
) -> ReviewResponse:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise errors.not_found("Request not found")

    is_requester = str(req.requester.id) == str(current_user.id)
    is_owner = str(req.owner.id) == str(current_user.id)

    if not is_requester and not is_owner:
        raise errors.forbidden("Access denied")

    if req.status != "finished":
        raise errors.bad_request("Reviews are only allowed for finished requests")

    if Review.objects(loan_request=req, reviewer=current_user).first():
        raise errors.conflict("You already reviewed this request")

    reviewed = req.owner if is_requester else req.requester

    review = Review(
        loan_request=req,
        reviewer=current_user,
        reviewed=reviewed,
        rating=data.rating,
        comment=data.comment,
    )
    try:
        review.save()
    except NotUniqueError as err:
        # Belt-and-suspenders against the check above: two near-simultaneous
        # requests can both pass it, but only one can win the unique index.
        raise errors.conflict("You already reviewed this request") from err
    recalculate_rating(reviewed)

    return _to_response(review)


def get_user_reviews(user_id: str) -> list[ReviewResponse]:
    user = User.objects(id=user_id, is_active=True).first()
    if not user:
        raise errors.not_found("User not found")
    return [
        _to_response(r) for r in Review.objects(reviewed=user).order_by("-created_at")
    ]


def get_given_reviews(current_user: User) -> list[ReviewResponse]:
    """Reviews the logged-in user has written about others — the flip side
    of get_user_reviews, which is what others wrote about them."""
    return [
        _to_response(r)
        for r in Review.objects(reviewer=current_user).order_by("-created_at")
    ]
