from app.models.user import NotificationPreferences, User
from app.schemas.user import NotificationPreferencesUpdate, UserResponse
from app.services.auth_service import user_to_response
from app.utils.time import utcnow


def update_notification_prefs(
    data: NotificationPreferencesUpdate, current_user: User
) -> UserResponse:
    current = current_user.notification_prefs
    updates = data.model_dump(exclude_none=True)
    merged = NotificationPreferences(
        request_status=updates.get("request_status", current.request_status),
        new_message=updates.get("new_message", current.new_message),
        verification_result=updates.get(
            "verification_result", current.verification_result
        ),
        item_available=updates.get("item_available", current.item_available),
        review_reminder=updates.get("review_reminder", current.review_reminder),
    )
    current_user.update(notification_prefs=merged, updated_at=utcnow())
    current_user.reload()
    return user_to_response(current_user)
