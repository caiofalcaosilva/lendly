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
    # Only the "finished" branch ever needed individual documents (to check
    # actual_return_date vs. expected_return_date per request) — refused/
    # cancelled were already .count()-only. Server-side $group replaces the
    # Python loop that used to materialize every finished LoanRequest.
    pipeline = [
        {"$match": {"requester": user.id, "status": "finished"}},
        {
            "$group": {
                "_id": None,
                "finished_count": {"$sum": 1},
                "on_time_count": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {"$ne": ["$actual_return_date", None]},
                                    {
                                        "$lte": [
                                            "$actual_return_date",
                                            "$expected_return_date",
                                        ]
                                    },
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
            }
        },
    ]
    result = list(LoanRequest.objects.aggregate(pipeline))
    finished_count = result[0]["finished_count"] if result else 0
    on_time_count = result[0]["on_time_count"] if result else 0

    count = finished_count
    points = (
        on_time_count * _ON_TIME_POINTS
        + (finished_count - on_time_count) * _LATE_POINTS
    )

    refused_count = LoanRequest.objects(owner=user, status="refused").count()
    count += refused_count
    points += refused_count * _REFUSED_POINTS

    cancelled_count = LoanRequest.objects(cancelled_by=user, status="cancelled").count()
    count += cancelled_count
    points += cancelled_count * _CANCELLED_POINTS

    updates = {}
    if finished_count > 0:
        updates["set__reputation__on_time_rate"] = round(
            100 * on_time_count / finished_count, 1
        )
        updates["set__reputation__finished_loans_count"] = finished_count
    if count > 0:
        updates["set__reputation__reliability_score"] = round(100 * points / count, 1)
        updates["set__reputation__reliability_count"] = count
    if updates:
        user.update(**updates)


def recalculate_response_time(owner: User) -> None:
    """Average minutes between a request landing and the owner accepting or
    refusing it — distinct from reliability_score, which only looks at what
    happens after acceptance. Averaged server-side via $group instead of
    pulling every responded LoanRequest into Python."""
    pipeline = [
        {
            "$match": {
                "owner": owner.id,
                "status": {"$in": ["accepted", "refused"]},
                "responded_at": {"$ne": None},
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_minutes": {
                    "$avg": {
                        "$divide": [
                            {"$subtract": ["$responded_at", "$created_at"]},
                            60000,
                        ]
                    }
                },
                "count": {"$sum": 1},
            }
        },
    ]
    result = list(LoanRequest.objects.aggregate(pipeline))
    if result:
        owner.update(
            set__reputation__avg_response_minutes=round(result[0]["avg_minutes"], 1),
            set__reputation__response_count=result[0]["count"],
        )
