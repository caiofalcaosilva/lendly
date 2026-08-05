from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.payment import Payment
from app.models.user import User
from app.schemas.analytics import (
    ItemAnalytics,
    OwnerAnalyticsSummary,
    RequesterSpendingSummary,
    SpendingEntry,
)
from app.utils.time import utcnow

# What actually left the requester's account — "pending"/"failed" never
# charged, "refunded" charged then came back.
_CHARGED_STATUSES = ("held", "released")


def _duration_days(req: LoanRequest) -> int:
    delta = (req.actual_return_date - req.pickup_date).days
    return max(delta, 1)


def get_owner_analytics(current_user: User) -> OwnerAnalyticsSummary:
    items = list(Item.objects(owner=current_user, is_active=True))
    now = utcnow()

    item_analytics: list[ItemAnalytics] = []
    for item in items:
        finished = LoanRequest.objects(item=item, status="finished")
        times_borrowed = 0
        revenue = 0.0
        days_rented = 0
        for req in finished:
            times_borrowed += 1
            duration = _duration_days(req)
            days_rented += duration
            if item.availability_type == "paid" and item.daily_rate:
                revenue += item.daily_rate * duration

        days_since_created = max((now - item.created_at).days, 1)
        occupancy_rate = round(min(100.0, 100 * days_rented / days_since_created), 1)

        item_analytics.append(
            ItemAnalytics(
                item_id=str(item.id),
                title=item.title,
                category=item.category,
                times_borrowed=times_borrowed,
                revenue=round(revenue, 2),
                occupancy_rate=occupancy_rate,
            )
        )

    item_analytics.sort(key=lambda i: (i.times_borrowed, i.revenue), reverse=True)

    total_loans = sum(i.times_borrowed for i in item_analytics)
    total_revenue = round(sum(i.revenue for i in item_analytics), 2)
    average_occupancy_rate = (
        round(sum(i.occupancy_rate for i in item_analytics) / len(item_analytics), 1)
        if item_analytics
        else 0.0
    )
    most_popular_item = (
        item_analytics[0].title
        if item_analytics and item_analytics[0].times_borrowed > 0
        else None
    )

    return OwnerAnalyticsSummary(
        total_items=len(item_analytics),
        total_loans=total_loans,
        total_revenue=total_revenue,
        average_occupancy_rate=average_occupancy_rate,
        most_popular_item=most_popular_item,
        items=item_analytics,
    )


def get_requester_spending(current_user: User) -> RequesterSpendingSummary:
    # max_depth=2 so loan_request.item is eager-loaded too, not just
    # loan_request itself — otherwise every entry below re-hits the DB for
    # item.title.
    payments = (
        Payment.objects(payer=current_user)
        .order_by("-created_at")
        .select_related(max_depth=2)
    )

    entries = [
        SpendingEntry(
            loan_request_id=str(p.loan_request.id),
            item_title=p.loan_request.item.title,
            amount=p.gross_amount,
            status=p.status,
            created_at=p.created_at,
        )
        for p in payments
    ]
    total_spent = round(
        sum(e.amount for e in entries if e.status in _CHARGED_STATUSES), 2
    )

    return RequesterSpendingSummary(
        total_spent=total_spent,
        payments_count=len(entries),
        payments=entries,
    )
