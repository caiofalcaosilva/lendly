from fastapi import (
    APIRouter,
    Depends,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from jose import JWTError

from app.dependencies import get_current_user
from app.models.activity import ACTIVITY_EVENTS
from app.models.user import User
from app.schemas.activity import ActivityResponse
from app.services import activity_service
from app.utils import errors
from app.utils.security import decode_token
from app.ws_manager import activity_manager

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("/", response_model=list[ActivityResponse])
def list_activities(
    before_id: str | None = Query(
        None,
        description="Id of the last activity seen — returns the page before it",
    ),
    limit: int = Query(20, ge=1, le=100),
    event: str | None = Query(None, description="Filter to a single event type"),
    resource_type: str | None = Query(None, description="Filter to a resource type"),
    resource_id: str | None = Query(
        None, description="Filter to a single resource, e.g. one group"
    ),
    current_user: User = Depends(get_current_user),
):
    """Paginated activity history for the logged-in user, newest first —
    persistent record of things that happened to/because of them, distinct
    from /notifications/ (which is opt-out and has a read/unread state).
    Cursor-based via `before_id`, same reasoning as list_notifications."""
    if event is not None and event not in ACTIVITY_EVENTS:
        raise errors.bad_request(f"Invalid event '{event}'")
    return activity_service.list_activities(
        current_user, before_id, limit, event, resource_type, resource_id
    )


@router.websocket("/ws")
async def activities_ws(websocket: WebSocket, token: str):
    """Live push for the personal activity-history page — one connection
    per logged-in user. Auth via `?token=` query param (browsers can't set
    headers on a WS handshake, same as chat/notifications/group-mural) —
    closes with 4401 if the token doesn't resolve to an active user."""
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

    await activity_manager.connect(str(user.id), websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        activity_manager.disconnect(str(user.id), websocket)
