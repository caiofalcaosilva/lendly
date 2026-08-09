from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from jose import JWTError

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.notification import (
    MarkAllReadResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.schemas.user import InAppNotificationPreferencesUpdate, UserResponse
from app.services import notification_service
from app.utils.security import decode_token
from app.ws_manager import notification_manager

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=list[NotificationResponse])
def list_notifications(
    before_id: str | None = Query(
        None,
        description="Id of the last notification seen — returns the page before it",
    ),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """Paginated notification history for the logged-in user, newest
    first. Cursor-based via `before_id` rather than skip, so a page stays
    stable even if new notifications arrive between page loads."""
    return notification_service.list_notifications(current_user, before_id, limit)


@router.get("/unread-count", response_model=UnreadCountResponse)
def unread_count(current_user: User = Depends(get_current_user)):
    """How many of the logged-in user's notifications are still unread —
    the number shown on the bell badge."""
    return UnreadCountResponse(
        count=notification_service.get_unread_count(current_user)
    )


@router.patch("/read-all", response_model=MarkAllReadResponse)
def mark_all_read(
    background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)
):
    """Marks every unread notification as read — fired when the bell
    panel opens, not via a manual button. Syncs to the same user's other
    open tabs/devices over their own /notifications/ws connections."""
    return MarkAllReadResponse(
        marked=notification_service.mark_all_read(current_user, background_tasks)
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Marks a single notification as read — same cross-tab/device sync
    as /read-all."""
    return notification_service.mark_read(
        notification_id, current_user, background_tasks
    )


@router.put("/preferences", response_model=UserResponse)
def update_preferences(
    data: InAppNotificationPreferencesUpdate,
    current_user: User = Depends(get_current_user),
):
    """Toggles which categories show up in the bell — independent from the
    email preferences in PUT /users/me/notification-preferences."""
    return notification_service.update_inapp_prefs(data, current_user)


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket, token: str):
    """Live push for the notification bell — one connection per logged-in
    user, regardless of which page they're on. Auth via `?token=` query
    param (browsers can't set headers on a WS handshake, same as the chat
    socket) — closes with 4401 if the token doesn't resolve to an active
    user."""
    user = None
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        user = User.objects(id=user_id, is_active=True).first() if user_id else None
    except JWTError:
        user = None

    if not user:
        await websocket.close(code=4401)
        return

    await notification_manager.connect(str(user.id), websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_manager.disconnect(str(user.id), websocket)
