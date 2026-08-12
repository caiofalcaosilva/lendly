import math
import os
import secrets
import uuid
from typing import Any

from fastapi import BackgroundTasks, UploadFile

from app.config import settings
from app.models.group import Group, Vouch
from app.models.group_post import GroupPost
from app.models.item import Item
from app.models.user import User
from app.schemas.group import (
    AdminGroupSummary,
    GroupCreate,
    GroupMemberResponse,
    GroupResponse,
    GroupSummary,
    GroupUpdate,
    NearbyGroup,
    Voucher,
)
from app.services import activity_service, notification_service
from app.utils import errors
from app.utils.images import load_and_resize

GROUP_PHOTO_DIMENSION = 400

# Same cap as items' "no meu bairro" feed (item_service/crud.py) — a
# neighbor-lending app has no business surfacing a group hundreds of km away.
DEFAULT_MAX_RADIUS_KM = 50


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return earth_radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _member_response(
    user: User, group: Group, viewer: User | None
) -> GroupMemberResponse:
    vouches_for_user = [
        v for v in group.vouches if str(v.vouched_for.id) == str(user.id)
    ]
    vouched_by_me = bool(
        viewer and any(str(v.voucher.id) == str(viewer.id) for v in vouches_for_user)
    )
    return GroupMemberResponse(
        id=str(user.id),
        name=user.name,
        avatar_url=user.avatar_url,
        average_rating=user.average_rating,
        vouch_count=len(vouches_for_user),
        vouched_by_me=vouched_by_me,
        is_moderator=any(str(m.id) == str(user.id) for m in group.moderators),
        vouchers=[
            Voucher(
                id=str(v.voucher.id),
                name=v.voucher.name,
                avatar_url=v.voucher.avatar_url,
                note=v.note,
            )
            for v in vouches_for_user
        ],
    )


def _is_creator_or_moderator(group: Group, user: User) -> bool:
    return str(group.created_by.id) == str(user.id) or any(
        str(m.id) == str(user.id) for m in group.moderators
    )


def _to_response(group: Group, viewer: User | None = None) -> GroupResponse:
    return GroupResponse(
        id=str(group.id),
        name=group.name,
        description=group.description,
        photo_url=group.photo_url,
        invite_code=group.invite_code,
        is_discoverable=group.is_discoverable,
        neighborhood=group.neighborhood,
        city=group.city,
        member_count=len(group.members),
        members=[_member_response(m, group, viewer) for m in group.members],
        created_by=str(group.created_by.id),
        created_at=group.created_at,
    )


def _to_summary(group: Group) -> GroupSummary:
    return GroupSummary(
        id=str(group.id),
        name=group.name,
        member_count=len(group.members),
        photo_url=group.photo_url,
    )


def _to_admin_summary(group: Group) -> AdminGroupSummary:
    return AdminGroupSummary(
        id=str(group.id),
        name=group.name,
        member_count=len(group.members),
        photo_url=group.photo_url,
        is_discoverable=group.is_discoverable,
        created_by_name=group.created_by.name,
        created_at=group.created_at,
    )


def _get_as_member(group_id: str, current_user: User) -> Group:
    group = Group.objects(id=group_id).first()
    if not group:
        raise errors.not_found("Group not found")
    if not any(str(m.id) == str(current_user.id) for m in group.members):
        # Groups are private — non-members get the same 404 a nonexistent
        # group would, rather than 403 (don't confirm the group exists).
        raise errors.not_found("Group not found")
    return group


def _strip_group_from_items(group: Group, user: User) -> None:
    """Removes `group` from this user's items' `groups` list, and — to avoid
    orphaning an item that's neither public nor in any remaining group —
    forces it back to public if that would otherwise leave it invisible."""
    for item in Item.objects(owner=user, groups=group):
        remaining = [g for g in item.groups if str(g.id) != str(group.id)]
        updates: dict[str, Any] = {"groups": remaining}
        if not remaining and not item.is_public:
            updates["is_public"] = True
        item.update(**updates)


def _strip_vouches(group: Group, user: User) -> None:
    """Drops any vouch involving `user` (given or received) — called when
    they leave or get removed, so a stale vouch can't reference a
    non-member."""
    remaining = [
        v
        for v in group.vouches
        if str(v.voucher.id) != str(user.id) and str(v.vouched_for.id) != str(user.id)
    ]
    if len(remaining) != len(group.vouches):
        group.update(vouches=remaining)


def create_group(data: GroupCreate, current_user: User) -> GroupResponse:
    group = Group(
        name=data.name,
        description=data.description,
        invite_code=secrets.token_urlsafe(12),
        created_by=current_user,
        members=[current_user],
        # Denormalized from the creator, same idea as Item's address fields —
        # only used if they later opt the group into "grupos perto de você".
        neighborhood=current_user.neighborhood,
        city=current_user.city,
        state=current_user.state,
        latitude=current_user.latitude,
        longitude=current_user.longitude,
    )
    group.save()
    activity_service.record(
        recipient=current_user,
        event="group.created",
        actor=current_user,
        resource_type="group",
        resource_id=str(group.id),
        resource_title=group.name,
    )
    return _to_response(group, viewer=current_user)


def update_group(group_id: str, data: GroupUpdate, current_user: User) -> GroupResponse:
    group = _get_as_member(group_id, current_user)
    if not _is_creator_or_moderator(group, current_user):
        raise errors.forbidden("Only the creator or a moderator can edit the group")
    if data.is_discoverable and (group.latitude is None or group.longitude is None):
        raise errors.bad_request(
            "O criador do grupo precisa ter um endereço com CEP cadastrado "
            "para tornar o grupo descobrível"
        )
    updates = data.model_dump(exclude_none=True)
    if updates:
        group.update(**updates)
        group.reload()
    return _to_response(group, viewer=current_user)


async def upload_photo(
    group_id: str, file: UploadFile, current_user: User
) -> GroupResponse:
    group = _get_as_member(group_id, current_user)
    if not _is_creator_or_moderator(group, current_user):
        raise errors.forbidden(
            "Only the creator or a moderator can change the group photo"
        )
    img = await load_and_resize(file)
    img.thumbnail((GROUP_PHOTO_DIMENSION, GROUP_PHOTO_DIMENSION))

    group_dir = os.path.join("uploads", "groups", str(group.id))
    os.makedirs(group_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    img.save(os.path.join(group_dir, filename), "JPEG", quality=85)

    url = f"{settings.API_PUBLIC_URL}/uploads/groups/{group.id}/{filename}"
    group.update(photo_url=url)
    group.reload()
    return _to_response(group, viewer=current_user)


def remove_photo(group_id: str, current_user: User) -> GroupResponse:
    group = _get_as_member(group_id, current_user)
    if not _is_creator_or_moderator(group, current_user):
        raise errors.forbidden(
            "Only the creator or a moderator can change the group photo"
        )
    group.update(unset__photo_url=1)
    group.reload()
    return _to_response(group, viewer=current_user)


def refresh_location(group_id: str, current_user: User) -> GroupResponse:
    """Re-syncs the group's denormalized location from its creator's
    *current* address. create_group only captures it once, at creation
    time (see the field comments on Group) — a creator who's since moved
    left the group showing stale coordinates in "grupos perto de você"
    with no way to fix it until now. Always pulls from the creator's
    address specifically, regardless of who (creator or moderator)
    clicks refresh, to keep the "group location = creator's location"
    invariant create_group established."""
    group = _get_as_member(group_id, current_user)
    if not _is_creator_or_moderator(group, current_user):
        raise errors.forbidden(
            "Only the creator or a moderator can refresh the group's location"
        )
    creator = group.created_by
    group.update(
        neighborhood=creator.neighborhood,
        city=creator.city,
        state=creator.state,
        latitude=creator.latitude,
        longitude=creator.longitude,
    )
    group.reload()
    return _to_response(group, viewer=current_user)


def regenerate_invite_code(group_id: str, current_user: User) -> GroupResponse:
    """Reissues the invite code — creator or moderator, e.g. after it leaked
    or the group wants to stop accepting new members via the old link."""
    group = _get_as_member(group_id, current_user)
    if not _is_creator_or_moderator(group, current_user):
        raise errors.forbidden(
            "Only the creator or a moderator can regenerate the invite code"
        )
    group.update(invite_code=secrets.token_urlsafe(12))
    group.reload()
    return _to_response(group, viewer=current_user)


def transfer_ownership(
    group_id: str,
    new_creator_id: str,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> GroupResponse:
    """Hands the group's creator role to another member — only the current
    creator can do this (unusually consequential, so no moderator can
    trigger it on their behalf). The old creator becomes a regular
    member; if the new creator happened to be a moderator, that's now
    redundant (creator is implicitly the group's top authority) and gets
    cleared, same as the invariant add_moderator already enforces."""
    group = _get_as_member(group_id, current_user)
    if str(group.created_by.id) != str(current_user.id):
        raise errors.forbidden("Only the creator can transfer ownership")
    if new_creator_id == str(current_user.id):
        raise errors.bad_request("Already the creator")
    new_creator = next((m for m in group.members if str(m.id) == new_creator_id), None)
    if not new_creator:
        raise errors.not_found("Member not found in this group")
    group.update(created_by=new_creator, pull__moderators=new_creator)
    group.reload()
    activity_service.record(
        recipient=new_creator,
        event="group.ownership_transferred",
        actor=current_user,
        resource_type="group",
        resource_id=str(group.id),
        resource_title=group.name,
    )
    if background_tasks:
        background_tasks.add_task(
            notification_service.create_notification,
            new_creator,
            "group_membership_changed",
            f"Você agora é o(a) criador(a) do grupo {group.name}",
            f"{current_user.name} transferiu a propriedade pra você.",
            f"/groups/{group.id}",
        )
    return _to_response(group, viewer=current_user)


def add_moderator(
    group_id: str,
    user_id: str,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> GroupResponse:
    """Appoints a fellow member as moderator — creator only, so moderators
    can't appoint or remove each other."""
    group = _get_as_member(group_id, current_user)
    if str(group.created_by.id) != str(current_user.id):
        raise errors.forbidden("Only the creator can appoint moderators")
    if user_id == str(group.created_by.id):
        raise errors.bad_request("The creator is already the group's top authority")
    target = next((m for m in group.members if str(m.id) == user_id), None)
    if not target:
        raise errors.not_found("Member not found in this group")
    already = any(str(m.id) == user_id for m in group.moderators)
    if not already:
        group.update(push__moderators=target)
        group.reload()
        activity_service.record(
            recipient=target,
            event="group.moderator_added",
            actor=current_user,
            resource_type="group",
            resource_id=str(group.id),
            resource_title=group.name,
        )
        if background_tasks:
            background_tasks.add_task(
                notification_service.create_notification,
                target,
                "group_membership_changed",
                f"Você virou moderador(a) do grupo {group.name}",
                "Agora você pode editar o grupo e remover membros.",
                f"/groups/{group.id}",
            )
    return _to_response(group, viewer=current_user)


def remove_moderator(
    group_id: str,
    user_id: str,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> GroupResponse:
    """Revokes a moderator's status — creator only. Doesn't remove them
    from the group, just the extra power."""
    group = _get_as_member(group_id, current_user)
    if str(group.created_by.id) != str(current_user.id):
        raise errors.forbidden("Only the creator can revoke moderators")
    target = next((m for m in group.moderators if str(m.id) == user_id), None)
    if target:
        group.update(pull__moderators=target)
        group.reload()
        activity_service.record(
            recipient=target,
            event="group.moderator_removed",
            actor=current_user,
            resource_type="group",
            resource_id=str(group.id),
            resource_title=group.name,
        )
        if background_tasks:
            background_tasks.add_task(
                notification_service.create_notification,
                target,
                "group_membership_changed",
                f"Você deixou de ser moderador(a) do grupo {group.name}",
                None,
                f"/groups/{group.id}",
            )
    return _to_response(group, viewer=current_user)


def remove_member(
    group_id: str,
    user_id: str,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> GroupResponse:
    """Group-level moderation — the creator or a moderator kicks a regular
    member out. Unlike admin_remove_member below, this is scoped to
    people who already run the group, not platform staff. A moderator
    can't remove another moderator or the creator; only the creator can
    (demote them with remove_moderator first, or remove them directly)."""
    group = _get_as_member(group_id, current_user)
    if not _is_creator_or_moderator(group, current_user):
        raise errors.forbidden("Only the creator or a moderator can remove a member")
    if user_id == str(group.created_by.id):
        raise errors.bad_request(
            "Não é possível remover o criador — exclua o grupo em vez disso",
        )
    member = next((m for m in group.members if str(m.id) == user_id), None)
    if not member:
        raise errors.not_found("Member not found in this group")
    is_target_moderator = any(str(m.id) == user_id for m in group.moderators)
    if is_target_moderator and str(group.created_by.id) != str(current_user.id):
        raise errors.forbidden("Only the creator can remove a moderator")
    _strip_group_from_items(group, member)
    _strip_vouches(group, member)
    group.update(pull__members=member, pull__moderators=member)
    group.reload()
    activity_service.record(
        recipient=member,
        event="group.member_removed",
        actor=current_user,
        resource_type="group",
        resource_id=str(group.id),
        resource_title=group.name,
    )
    if background_tasks:
        background_tasks.add_task(
            notification_service.create_notification,
            member,
            "group_membership_changed",
            f"Você foi removido(a) do grupo {group.name}",
            None,
            "/groups",
        )
    return _to_response(group, viewer=current_user)


def get_my_groups(current_user: User) -> list[GroupSummary]:
    return [
        _to_summary(g) for g in Group.objects(members=current_user).order_by("name")
    ]


def list_nearby_groups(
    current_user: User,
    lat: float | None,
    lng: float | None,
    lat2: float | None,
    lng2: float | None,
    radius_km: float | None,
) -> list[NearbyGroup]:
    """Discoverable groups near the given origin(s) that current_user isn't
    already in — same "up to two origins, union, capped radius" approach as
    item_service.list_items's neighborhood feed, just applied to Group
    instead of an actual geospatial query."""
    origin_candidates = [(lat, lng), (lat2, lng2)]
    origins = [
        (o_lat, o_lng)
        for o_lat, o_lng in origin_candidates
        if o_lat is not None and o_lng is not None
    ]
    if not origins:
        return []
    effective_radius = radius_km or DEFAULT_MAX_RADIUS_KM

    candidates = Group.objects(is_discoverable=True, members__ne=current_user).order_by(
        "name"
    )
    nearby = []
    for group in candidates:
        if group.latitude is None or group.longitude is None:
            continue
        distance = min(
            _haversine_km(o_lat, o_lng, group.latitude, group.longitude)
            for o_lat, o_lng in origins
        )
        if distance <= effective_radius:
            nearby.append((distance, group))
    nearby.sort(key=lambda pair: pair[0])
    return [
        NearbyGroup(
            id=str(group.id),
            name=group.name,
            description=group.description,
            photo_url=group.photo_url,
            neighborhood=group.neighborhood,
            city=group.city,
            member_count=len(group.members),
            distance_km=round(distance, 1),
        )
        for distance, group in nearby
    ]


def join_discoverable_group(group_id: str, current_user: User) -> GroupResponse:
    """Joins a group found via "grupos perto de você" — no invite code
    needed, since the group itself opted into being discoverable."""
    group = Group.objects(id=group_id, is_discoverable=True).first()
    if not group:
        raise errors.not_found("Group not found")
    is_member = any(str(m.id) == str(current_user.id) for m in group.members)
    if not is_member and not current_user.is_admin:
        group.update(push__members=current_user)
        group.reload()
        activity_service.record(
            recipient=current_user,
            event="group.joined",
            actor=current_user,
            resource_type="group",
            resource_id=str(group.id),
            resource_title=group.name,
        )
    return _to_response(group, viewer=current_user)


def _get_group_readable(group_id: str, current_user: User) -> Group:
    """Like _get_as_member, but also lets an admin read a group they're not
    in — used only by get_group (read-only). leave_group/delete_group keep
    using the stricter _get_as_member, since bypassing membership there
    doesn't make sense (an admin "leaving" a group they were never in)."""
    group = Group.objects(id=group_id).first()
    if not group:
        raise errors.not_found("Group not found")
    is_member = any(str(m.id) == str(current_user.id) for m in group.members)
    if not is_member and not current_user.is_admin:
        raise errors.not_found("Group not found")
    return group


def get_group(group_id: str, current_user: User) -> GroupResponse:
    group = _get_group_readable(group_id, current_user)
    return _to_response(group, viewer=current_user)


def list_all_groups(
    search: str | None = None, skip: int = 0, limit: int = 50
) -> list[AdminGroupSummary]:
    """Admin-only — every group on the platform, not just ones the caller
    belongs to. See routers/admin/groups.py. Newest first, since that's
    the direction a moderator scanning for freshly-created spam groups
    cares about most; `search` narrows by name (case-insensitive)."""
    qs = Group.objects()
    if search:
        qs = qs.filter(name__icontains=search)
    groups = qs.order_by("-created_at").skip(skip).limit(limit)
    return [_to_admin_summary(g) for g in groups]


def join_group(invite_code: str, current_user: User) -> GroupResponse:
    group = Group.objects(invite_code=invite_code).first()
    if not group:
        raise errors.not_found("Invalid invite code")
    # Admins never become members — they can already view any group read-only.
    is_member = any(str(m.id) == str(current_user.id) for m in group.members)
    if not is_member and not current_user.is_admin:
        group.update(push__members=current_user)
        group.reload()
        activity_service.record(
            recipient=current_user,
            event="group.joined",
            actor=current_user,
            resource_type="group",
            resource_id=str(group.id),
            resource_title=group.name,
        )
    return _to_response(group, viewer=current_user)


def leave_group(group_id: str, current_user: User) -> dict:
    group = _get_as_member(group_id, current_user)
    if str(group.created_by.id) == str(current_user.id):
        raise errors.bad_request(
            "The creator can't leave — delete the group instead",
        )
    _strip_group_from_items(group, current_user)
    _strip_vouches(group, current_user)
    group.update(pull__members=current_user, pull__moderators=current_user)
    activity_service.record(
        recipient=current_user,
        event="group.left",
        actor=current_user,
        resource_type="group",
        resource_id=str(group.id),
        resource_title=group.name,
    )
    return {"detail": "Left the group"}


def delete_group(
    group_id: str,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> None:
    group = _get_as_member(group_id, current_user)
    if str(group.created_by.id) != str(current_user.id):
        raise errors.forbidden("Only the creator can delete the group")
    members = list(group.members)
    group_name = group.name
    for member in members:
        _strip_group_from_items(group, member)
    GroupPost.objects(group=group).delete()
    group.delete()
    for member in members:
        activity_service.record(
            recipient=member,
            event="group.deleted",
            actor=current_user,
            resource_type="group",
            resource_id=group_id,
            resource_title=group_name,
        )
        if background_tasks and str(member.id) != str(current_user.id):
            background_tasks.add_task(
                notification_service.create_notification,
                member,
                "group_membership_changed",
                f"O grupo {group_name} foi excluído",
                None,
                "/groups",
            )


def admin_delete_group(
    group_id: str, admin: User, background_tasks: BackgroundTasks | None = None
) -> None:
    """Moderation action — deletes any group regardless of creator, unlike
    delete_group above which only the creator can invoke."""
    group = Group.objects(id=group_id).first()
    if not group:
        raise errors.not_found("Group not found")
    members = list(group.members)
    group_name = group.name
    for member in members:
        _strip_group_from_items(group, member)
    GroupPost.objects(group=group).delete()
    group.delete()
    for member in members:
        activity_service.record(
            recipient=member,
            event="admin.group_deleted",
            actor=admin,
            resource_type="group",
            resource_id=group_id,
            resource_title=group_name,
        )
        if background_tasks:
            background_tasks.add_task(
                notification_service.create_notification,
                member,
                "group_membership_changed",
                f"O grupo {group_name} foi removido pela moderação",
                None,
                "/groups",
            )


def admin_remove_member(
    group_id: str,
    user_id: str,
    admin: User,
    background_tasks: BackgroundTasks | None = None,
) -> GroupResponse:
    """Moderation action — kicks a member out of a group. The creator can't
    be removed this way (mirrors leave_group's block); delete the group
    instead."""
    group = Group.objects(id=group_id).first()
    if not group:
        raise errors.not_found("Group not found")
    member = next((m for m in group.members if str(m.id) == user_id), None)
    if not member:
        raise errors.not_found("Member not found in this group")
    if str(group.created_by.id) == user_id:
        raise errors.bad_request(
            "Não é possível remover o criador — exclua o grupo em vez disso",
        )
    _strip_group_from_items(group, member)
    _strip_vouches(group, member)
    group.update(pull__members=member, pull__moderators=member)
    group.reload()
    activity_service.record(
        recipient=member,
        event="admin.group_member_removed",
        actor=admin,
        resource_type="group",
        resource_id=str(group.id),
        resource_title=group.name,
    )
    if background_tasks:
        background_tasks.add_task(
            notification_service.create_notification,
            member,
            "group_membership_changed",
            f"Você foi removido(a) do grupo {group.name}",
            None,
            "/groups",
        )
    return _to_response(group)


def vouch_for_member(
    group_id: str,
    user_id: str,
    current_user: User,
    note: str | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> GroupResponse:
    """Confirms `current_user` personally knows the member at `user_id`,
    within this group, with optional short context ("vizinho de prédio").
    Idempotent — re-vouching is a no-op (including when it carries a
    different note — the note is fixed at first-vouch time, not editable
    by vouching again), not an error."""
    group = _get_as_member(group_id, current_user)
    if user_id == str(current_user.id):
        raise errors.bad_request("Cannot vouch for yourself")
    target = next((m for m in group.members if str(m.id) == user_id), None)
    if not target:
        raise errors.not_found("Member not found in this group")

    already = any(
        str(v.voucher.id) == str(current_user.id) and str(v.vouched_for.id) == user_id
        for v in group.vouches
    )
    if not already:
        group.update(
            push__vouches=Vouch(voucher=current_user, vouched_for=target, note=note)
        )
        group.reload()
        activity_service.record(
            recipient=target,
            event="group.vouch_received",
            actor=current_user,
            resource_type="group",
            resource_id=str(group.id),
            resource_title=group.name,
        )
        if background_tasks:
            body = f"No grupo {group.name}"
            if note:
                body += f' — "{note}"'
            background_tasks.add_task(
                notification_service.create_notification,
                target,
                "group_vouch",
                f"{current_user.name} confirmou que conhece você",
                body,
                f"/groups/{group.id}",
            )
    return _to_response(group, viewer=current_user)


def unvouch_for_member(
    group_id: str, user_id: str, current_user: User
) -> GroupResponse:
    group = _get_as_member(group_id, current_user)
    remaining = [
        v
        for v in group.vouches
        if not (
            str(v.voucher.id) == str(current_user.id)
            and str(v.vouched_for.id) == user_id
        )
    ]
    if len(remaining) != len(group.vouches):
        group.update(vouches=remaining)
        group.reload()
        target = next((m for m in group.members if str(m.id) == user_id), None)
        if target:
            activity_service.record(
                recipient=target,
                event="group.vouch_withdrawn",
                actor=current_user,
                resource_type="group",
                resource_id=str(group.id),
                resource_title=group.name,
            )
    return _to_response(group, viewer=current_user)
