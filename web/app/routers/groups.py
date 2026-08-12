from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Query,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from jose import JWTError

from app.dependencies import get_current_user
from app.models.group import Group
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.group import (
    GroupCreate,
    GroupMemberResponse,
    GroupResponse,
    GroupSummary,
    GroupUpdate,
    JoinGroupRequest,
    NearbyGroup,
    TransferOwnershipRequest,
    VouchCreate,
)
from app.schemas.group_post import GroupPostCreate, GroupPostResponse
from app.schemas.item import ItemResponse
from app.services import group_post_service, group_service, item_service
from app.services.platform_settings_service import get_settings as get_platform_settings
from app.utils.security import decode_token
from app.ws_manager import group_post_manager

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("/", response_model=GroupResponse, status_code=201)
@limiter.limit(
    lambda: f"{get_platform_settings().group_create_rate_limit_per_minute}/minute"
)
def create_group(
    data: GroupCreate, request: Request, current_user: User = Depends(get_current_user)
):
    """Creates a private group with a shareable invite code — the creator
    becomes its first member."""
    return group_service.create_group(data, current_user)


@router.get("/me", response_model=list[GroupSummary])
def my_groups(
    search: str | None = Query(None, description="Filter by name (case-insensitive)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
):
    """Groups the logged-in user belongs to, alphabetical and paginated."""
    return group_service.get_my_groups(current_user, search, skip, limit)


@router.post("/join", response_model=GroupResponse)
def join_group(data: JoinGroupRequest, current_user: User = Depends(get_current_user)):
    """Joins a group via its invite code."""
    return group_service.join_group(data.invite_code, current_user)


@router.get("/discover", response_model=list[NearbyGroup])
def discover_groups(
    lat: float | None = Query(None, description="Primary origin (e.g. home address)"),
    lng: float | None = Query(None),
    lat2: float | None = Query(
        None, description="Secondary origin (e.g. live location)"
    ),
    lng2: float | None = Query(None),
    radius_km: float | None = Query(None, ge=0.1),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """Discoverable groups near the given origin(s) (home address and/or
    live browser location) that the caller isn't already in — "grupos perto
    de você". Closest first, paginated. Empty without at least one origin."""
    return group_service.list_nearby_groups(
        current_user, lat, lng, lat2, lng2, radius_km, skip, limit
    )


@router.get("/{group_id}", response_model=GroupResponse)
def get_group(group_id: str, current_user: User = Depends(get_current_user)):
    """A group's detail — members only, admins can also read groups
    they're not in. Members themselves are fetched separately, paginated,
    via GET /{group_id}/members."""
    return group_service.get_group(group_id, current_user)


@router.get("/{group_id}/members", response_model=list[GroupMemberResponse])
def list_group_members(
    group_id: str,
    search: str | None = Query(None, description="Filter by name (case-insensitive)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
):
    """A group's members, alphabetical and paginated — a group can have
    hundreds or thousands of members, so this is never returned in full by
    GET /{group_id}. Members only, admins can also read groups they're not
    in."""
    return group_service.list_group_members(group_id, current_user, search, skip, limit)


@router.patch("/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: str, data: GroupUpdate, current_user: User = Depends(get_current_user)
):
    """Edits a group's name/description — creator or moderator."""
    return group_service.update_group(group_id, data, current_user)


@router.post("/{group_id}/photo", response_model=GroupResponse, status_code=201)
async def upload_group_photo(
    group_id: str, file: UploadFile, current_user: User = Depends(get_current_user)
):
    """Uploads a group photo — resized, replaces any existing one. Creator
    or moderator."""
    return await group_service.upload_photo(group_id, file, current_user)


@router.delete("/{group_id}/photo", response_model=GroupResponse)
def remove_group_photo(group_id: str, current_user: User = Depends(get_current_user)):
    """Removes the group photo — falls back to the default icon in the
    UI. Creator or moderator."""
    return group_service.remove_photo(group_id, current_user)


@router.post("/{group_id}/invite-code/regenerate", response_model=GroupResponse)
def regenerate_invite_code(
    group_id: str, current_user: User = Depends(get_current_user)
):
    """Reissues the group's invite code, invalidating the old one —
    creator or moderator."""
    return group_service.regenerate_invite_code(group_id, current_user)


@router.post("/{group_id}/refresh-location", response_model=GroupResponse)
def refresh_location(group_id: str, current_user: User = Depends(get_current_user)):
    """Re-syncs the group's location from its creator's current address —
    creator or moderator."""
    return group_service.refresh_location(group_id, current_user)


@router.post("/{group_id}/join", response_model=GroupResponse)
def join_discoverable_group(
    group_id: str, current_user: User = Depends(get_current_user)
):
    """Joins a group found via /groups/discover — no invite code needed,
    since the group opted into being discoverable."""
    return group_service.join_discoverable_group(group_id, current_user)


@router.post("/{group_id}/leave")
def leave_group(group_id: str, current_user: User = Depends(get_current_user)):
    """Leaves a group — the creator can't leave (delete the group
    instead)."""
    return group_service.leave_group(group_id, current_user)


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Deletes a group — creator only."""
    group_service.delete_group(group_id, current_user, background_tasks)


@router.get("/{group_id}/items", response_model=list[ItemResponse])
def group_items(
    group_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(24, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """Items shared with a group, newest first — members only. Paginated,
    same reasoning as GET /{group_id}/members: a long-lived group can
    accumulate far more items than fit on one screen."""
    return item_service.list_group_items(group_id, current_user, skip, limit)


@router.get("/{group_id}/posts", response_model=list[GroupPostResponse])
def list_group_posts(
    group_id: str,
    before_id: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """The group's mural — a simple text announcement board, newest first.
    Members only."""
    return group_post_service.list_posts(group_id, current_user, before_id, limit)


@router.post("/{group_id}/posts", response_model=GroupPostResponse, status_code=201)
@limiter.limit(
    lambda: f"{get_platform_settings().group_post_rate_limit_per_minute}/minute"
)
def create_group_post(
    group_id: str,
    data: GroupPostCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Posts to the group's mural — any member. Broadcast live to other
    members connected to the /posts/ws socket."""
    return group_post_service.create_post(
        group_id, data, current_user, background_tasks
    )


@router.delete("/{group_id}/posts/{post_id}", status_code=204)
def delete_group_post(
    group_id: str,
    post_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Deletes a mural post — its author, the group's creator, or a
    moderator."""
    group_post_service.delete_post(group_id, post_id, current_user, background_tasks)


@router.websocket("/{group_id}/posts/ws")
async def group_posts_ws(websocket: WebSocket, group_id: str, token: str):
    """Live mural socket for a group. Auth via `?token=` query param
    (browsers can't set headers on a WS handshake) — closes with 4401 if
    the token doesn't belong to a member (admins included, same read
    leniency as the REST endpoints)."""
    is_allowed = False
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        user = User.objects(id=user_id, is_active=True).first() if user_id else None
        group = Group.objects(id=group_id).first() if user else None
        if user and group:
            is_member = any(str(m.id) == str(user.id) for m in group.members)
            is_allowed = is_member or user.is_admin
    except JWTError:
        is_allowed = False

    if not is_allowed:
        await websocket.close(code=4401)
        return

    await group_post_manager.connect(group_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        group_post_manager.disconnect(group_id, websocket)


@router.post("/{group_id}/members/{user_id}/vouch", response_model=GroupMemberResponse)
def vouch_for_member(
    group_id: str,
    user_id: str,
    background_tasks: BackgroundTasks,
    data: VouchCreate | None = None,
    current_user: User = Depends(get_current_user),
):
    """Confirms the logged-in user personally knows this fellow group
    member — a light trust signal scoped to people who already share a
    private, invite-only group. Body is optional; `note` within it is
    optional short context, e.g. "vizinho de prédio"."""
    return group_service.vouch_for_member(
        group_id, user_id, current_user, data.note if data else None, background_tasks
    )


@router.delete(
    "/{group_id}/members/{user_id}/vouch", response_model=GroupMemberResponse
)
def unvouch_for_member(
    group_id: str, user_id: str, current_user: User = Depends(get_current_user)
):
    """Withdraws a vouch given earlier."""
    return group_service.unvouch_for_member(group_id, user_id, current_user)


@router.post("/{group_id}/transfer-ownership", response_model=GroupResponse)
def transfer_ownership(
    group_id: str,
    data: TransferOwnershipRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Hands the group's creator role to another member — creator only."""
    return group_service.transfer_ownership(
        group_id, data.new_creator_id, current_user, background_tasks
    )


@router.post(
    "/{group_id}/members/{user_id}/moderator", response_model=GroupMemberResponse
)
def add_moderator(
    group_id: str,
    user_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Appoints a fellow member as moderator — creator only."""
    return group_service.add_moderator(
        group_id, user_id, current_user, background_tasks
    )


@router.delete(
    "/{group_id}/members/{user_id}/moderator", response_model=GroupMemberResponse
)
def remove_moderator(
    group_id: str,
    user_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Revokes a member's moderator status — creator only."""
    return group_service.remove_moderator(
        group_id, user_id, current_user, background_tasks
    )


@router.delete("/{group_id}/members/{user_id}", response_model=GroupResponse)
def remove_member(
    group_id: str,
    user_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Kicks a regular member out of the group — creator or moderator.
    Unlike DELETE /admin/groups/{group_id}/members/{user_id}, this is
    group-level, not platform moderation."""
    return group_service.remove_member(
        group_id, user_id, current_user, background_tasks
    )
