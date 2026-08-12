from fastapi import BackgroundTasks

from app.models.notification import Notification
from app.models.user import InAppNotificationPreferences, User
from app.schemas.notification import NotificationResponse
from app.schemas.user import InAppNotificationPreferencesUpdate, UserResponse
from app.services.auth_service import user_to_response
from app.utils import errors
from app.utils.notifications import is_security_category, should_notify_inapp
from app.utils.time import utcnow
from app.ws_manager import notification_manager


def _to_response(notif: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=str(notif.id),
        type=notif.type,
        title=notif.title,
        body=notif.body,
        link=notif.link,
        read_at=notif.read_at,
        created_at=notif.created_at,
    )


async def create_notification(
    recipient: User,
    type_: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
) -> None:
    """Writes the notification and pushes it live over the recipient's
    /notifications/ws connection, if they have one open. A no-op if the
    recipient has this category turned off — same gate shape as the email
    side, but a separate preference set (see should_notify_inapp). Security
    categories (e.g. new_login) skip the gate entirely — not toggleable."""
    if not is_security_category(type_) and not should_notify_inapp(recipient, type_):
        return
    notif = Notification(
        recipient=recipient, type=type_, title=title, body=body, link=link
    )
    notif.save()
    await notification_manager.broadcast(
        str(recipient.id),
        {"kind": "notification", **_to_response(notif).model_dump(mode="json")},
    )


async def _broadcast_sync(user: User, payload: dict) -> None:
    """Tells every other open tab/device of this user that something
    changed (read, read-all, deleted, cleared), so their badge/list stays
    in sync without a manual refresh — same channel create_notification
    pushes over, distinguished by `kind`."""
    await notification_manager.broadcast(str(user.id), payload)


def list_notifications(
    current_user: User,
    before_id: str | None,
    limit: int,
    type_: str | None = None,
) -> list[NotificationResponse]:
    """Cursor-based, not skip-based — passing the last-seen id as
    `before_id` keeps pages stable even if new notifications land between
    page loads. Sorts and filters on `id`, not `created_at` — ObjectId
    only carries second-level timestamp precision, so two rows created in
    the same second can tie on created_at; sorting by one field while
    cursoring on another risks a row landing on both pages (or neither)
    right at the boundary. Using id for both keeps them consistent, and
    id still sorts newest-first the same way created_at would."""
    qs = Notification.objects(recipient=current_user)
    if type_:
        qs = qs.filter(type=type_)
    if before_id:
        qs = qs.filter(id__lt=before_id)
    notifs = qs.order_by("-id").limit(limit)
    return [_to_response(n) for n in notifs]


def get_unread_count(current_user: User) -> int:
    return Notification.objects(recipient=current_user, read_at=None).count()


def mark_read(
    notification_id: str,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> NotificationResponse:
    notif = Notification.objects(id=notification_id, recipient=current_user).first()
    if not notif:
        raise errors.not_found("Notification not found")
    if not notif.read_at:
        notif.update(read_at=utcnow())
        notif.reload()
        if background_tasks:
            background_tasks.add_task(
                _broadcast_sync,
                current_user,
                {"kind": "read", "id": str(notif.id)},
            )
    return _to_response(notif)


def mark_all_read(
    current_user: User, background_tasks: BackgroundTasks | None = None
) -> int:
    count = Notification.objects(recipient=current_user, read_at=None).update(
        read_at=utcnow()
    )
    if background_tasks and count:
        background_tasks.add_task(_broadcast_sync, current_user, {"kind": "read_all"})
    return count


def delete_notification(
    notification_id: str,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> None:
    notif = Notification.objects(id=notification_id, recipient=current_user).first()
    if not notif:
        raise errors.not_found("Notification not found")
    was_unread = notif.read_at is None
    notif.delete()
    if background_tasks:
        background_tasks.add_task(
            _broadcast_sync,
            current_user,
            {"kind": "deleted", "id": notification_id, "was_unread": was_unread},
        )


def clear_read_notifications(
    current_user: User, background_tasks: BackgroundTasks | None = None
) -> int:
    """Bulk-removes every already-read notification — read_at=None ones are
    deliberately untouched, so this can never delete something the user
    hasn't seen yet even if called by mistake."""
    qs = Notification.objects(recipient=current_user, read_at__ne=None)
    count = qs.count()
    qs.delete()
    if background_tasks and count:
        background_tasks.add_task(
            _broadcast_sync, current_user, {"kind": "cleared_read"}
        )
    return count


def update_inapp_prefs(
    data: InAppNotificationPreferencesUpdate, current_user: User
) -> UserResponse:
    current = current_user.inapp_notification_prefs
    updates = data.model_dump(exclude_none=True)
    merged = InAppNotificationPreferences(
        request_status=updates.get("request_status", current.request_status),
        new_message=updates.get("new_message", current.new_message),
        verification_result=updates.get(
            "verification_result", current.verification_result
        ),
        item_available=updates.get("item_available", current.item_available),
        review_reminder=updates.get("review_reminder", current.review_reminder),
        group_vouch=updates.get("group_vouch", current.group_vouch),
        favorite_item_changed=updates.get(
            "favorite_item_changed", current.favorite_item_changed
        ),
        group_new_item=updates.get("group_new_item", current.group_new_item),
        group_membership_changed=updates.get(
            "group_membership_changed", current.group_membership_changed
        ),
    )
    current_user.update(inapp_notification_prefs=merged, updated_at=utcnow())
    current_user.reload()
    return user_to_response(current_user)
