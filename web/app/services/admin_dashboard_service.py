from collections import Counter
from datetime import timedelta

from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.report import Report
from app.models.user import User
from app.models.verification import VerificationSubmission
from app.schemas.admin_dashboard import (
    AdminDashboardSummary,
    CategoryCount,
    CityCount,
    WeeklySignups,
)
from app.utils.time import utcnow

TOP_N = 5
WEEKS = 8


def _signups_last_8_weeks() -> list:
    now = utcnow()
    weeks = []
    for i in range(WEEKS - 1, -1, -1):
        start = now - timedelta(weeks=i + 1)
        end = now - timedelta(weeks=i)
        count = User.objects(created_at__gte=start, created_at__lt=end).count()
        weeks.append(WeeklySignups(week_start=start.date().isoformat(), count=count))
    return weeks


def get_admin_dashboard() -> AdminDashboardSummary:
    active_items_qs = Item.objects(is_active=True)

    categories = [i.category for i in active_items_qs.only("category")]
    top_categories = [
        CategoryCount(category=c, count=n)
        for c, n in Counter(categories).most_common(TOP_N)
    ]

    cities = [
        i.city for i in active_items_qs.filter(city__ne=None).only("city") if i.city
    ]
    top_cities = [
        CityCount(city=c, count=n) for c, n in Counter(cities).most_common(TOP_N)
    ]

    return AdminDashboardSummary(
        total_users=User.objects(is_active=True).count(),
        total_items=active_items_qs.count(),
        active_items=Item.objects(is_active=True, is_available=True).count(),
        loans_pending=LoanRequest.objects(status="pending").count(),
        loans_in_progress=LoanRequest.objects(status="in_progress").count(),
        loans_finished=LoanRequest.objects(status="finished").count(),
        loans_cancelled_or_refused=LoanRequest.objects(
            status__in=["cancelled", "refused"]
        ).count(),
        pending_reports=Report.objects(status="pending").count(),
        pending_verifications=VerificationSubmission.objects(status="pending").count(),
        signups_last_8_weeks=_signups_last_8_weeks(),
        top_categories=top_categories,
        top_cities=top_cities,
    )
