import logging
from datetime import timedelta

from app.models.loan_request import LoanRequest
from app.models.review import Review
from app.services import email_service, notification_service
from app.utils.notifications import should_notify
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

DAYS_AFTER_FINISH = 3


async def send_pending_review_reminders() -> int:
    """Nudges either party of a finished loan who hasn't reviewed the other
    side yet, a few days after return — one-shot per request via
    review_reminder_sent_at, regardless of whether either party actually
    needed a nudge. Meant to run on a daily schedule (see main.py)."""
    cutoff = utcnow() - timedelta(days=DAYS_AFTER_FINISH)
    candidates = LoanRequest.objects(
        status="finished",
        actual_return_date__lte=cutoff,
        review_reminder_sent_at=None,
    ).select_related(max_depth=1)

    sent = 0
    for req in candidates:
        for reviewer in (req.requester, req.owner):
            already_reviewed = Review.objects(
                loan_request=req, reviewer=reviewer
            ).first()
            if already_reviewed:
                continue
            if should_notify(reviewer, "review_reminder"):
                await email_service.send_review_reminder_email(
                    reviewer.email, reviewer.name, req.item.title, str(req.id)
                )
                sent += 1
            await notification_service.create_notification(
                reviewer,
                "review_reminder",
                "Que tal avaliar esse empréstimo?",
                req.item.title,
                f"/requests/{req.id}",
            )
        req.update(review_reminder_sent_at=utcnow())

    if candidates:
        logger.info(
            "review reminders processed",
            extra={"requests_checked": len(candidates), "emails_sent": sent},
        )
    return sent
