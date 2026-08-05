"""Behavioral score (0-100) distinct from average_rating: how often this user
follows through — on-time returns, vs. late returns / refusals / cancellations.
Full recompute on every relevant transition, same pattern as
review_service._recalculate_rating."""

from app.models.loan_request import LoanRequest
from app.models.user import User

_ON_TIME_POINTS = 1.0
_LATE_POINTS = 0.5
_REFUSED_POINTS = 0.7  # softer than a cancellation — declining a still-pending
# request breaks no promise, unlike backing out after already committing.
_CANCELLED_POINTS = 0.0


def recalculate_reliability(user: User) -> None:
    points = 0.0
    count = 0
    finished_count = 0
    on_time_count = 0

    for req in LoanRequest.objects(requester=user, status="finished"):
        count += 1
        finished_count += 1
        on_time = (
            req.actual_return_date
            and req.actual_return_date <= req.expected_return_date
        )
        if on_time:
            on_time_count += 1
        points += _ON_TIME_POINTS if on_time else _LATE_POINTS

    refused_count = LoanRequest.objects(owner=user, status="refused").count()
    count += refused_count
    points += refused_count * _REFUSED_POINTS

    cancelled_count = LoanRequest.objects(cancelled_by=user, status="cancelled").count()
    count += cancelled_count
    points += cancelled_count * _CANCELLED_POINTS

    updates = {}
    if finished_count > 0:
        updates["on_time_rate"] = round(100 * on_time_count / finished_count, 1)
        updates["finished_loans_count"] = finished_count
    if count > 0:
        updates["reliability_score"] = round(100 * points / count, 1)
        updates["reliability_count"] = count
    if updates:
        user.update(**updates)


def recalculate_response_time(owner: User) -> None:
    """Average minutes between a request landing and the owner accepting or
    refusing it — distinct from reliability_score, which only looks at what
    happens after acceptance."""
    responded = LoanRequest.objects(
        owner=owner, status__in=["accepted", "refused"], responded_at__ne=None
    )
    deltas = [
        (req.responded_at - req.created_at).total_seconds() / 60 for req in responded
    ]
    if deltas:
        owner.update(
            avg_response_minutes=round(sum(deltas) / len(deltas), 1),
            response_count=len(deltas),
        )
