import json
import logging

from pywebpush import WebPushException, webpush

from app.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)


def send_push(
    user: User, notification_id: str, title: str, body: str | None, link: str | None
) -> None:
    """Best-effort — inert until VAPID_PRIVATE_KEY is configured, same
    pattern as every other external integration in this codebase. Prunes
    a subscription that comes back 404/410 (endpoint expired/revoked)
    instead of leaving it to fail forever.

    notification_id becomes the OS notification's `tag` (see public/sw.js)
    — each real notification gets its own, so several stack in the tray
    instead of replacing each other; only a genuine re-delivery of the
    same notification collapses onto the same entry."""
    if not settings.VAPID_PRIVATE_KEY:
        return
    for sub in list(user.push_subscriptions):
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=json.dumps(
                    {"id": notification_id, "title": title, "body": body, "link": link}
                ),
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
            )
        except WebPushException as e:
            status = e.response.status_code if e.response is not None else None
            if status in (404, 410):
                User.objects(id=user.id).update(
                    pull__push_subscriptions__endpoint=sub.endpoint
                )
            else:
                logger.warning(
                    "push send failed", extra={"status": status, "error": str(e)}
                )
