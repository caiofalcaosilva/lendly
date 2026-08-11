import secrets
from typing import Any

from fastapi import BackgroundTasks

from app.models.group import Group, Vouch
from app.models.item import Item
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupMemberResponse,
    GroupResponse,
    GroupSummary,
)
from app.services import activity_service, notification_service
from app.utils import errors


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
        average_rating=user.average_rating,
        vouch_count=len(vouches_for_user),
        vouched_by_me=vouched_by_me,
    )


def _to_response(group: Group, viewer: User | None = None) -> GroupResponse:
    return GroupResponse(
        id=str(group.id),
        name=group.name,
        description=group.description,
        invite_code=group.invite_code,
        member_count=len(group.members),
        members=[_member_response(m, group, viewer) for m in group.members],
        created_by=str(group.created_by.id),
        created_at=group.created_at,
    )


def _to_summary(group: Group) -> GroupSummary:
    return GroupSummary(
        id=str(group.id), name=group.name, member_count=len(group.members)
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
    )
    group.save()
    return _to_response(group, viewer=current_user)


def get_my_groups(current_user: User) -> list[GroupSummary]:
    return [
        _to_summary(g) for g in Group.objects(members=current_user).order_by("name")
    ]


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


def list_all_groups() -> list[GroupSummary]:
    """Admin-only — every group on the platform, not just ones the caller
    belongs to. See routers/admin/groups.py."""
    return [_to_summary(g) for g in Group.objects().order_by("name")]


def join_group(invite_code: str, current_user: User) -> GroupResponse:
    group = Group.objects(invite_code=invite_code).first()
    if not group:
        raise errors.not_found("Invalid invite code")
    # Admins never become members — they can already view any group read-only.
    is_member = any(str(m.id) == str(current_user.id) for m in group.members)
    if not is_member and not current_user.is_admin:
        group.update(push__members=current_user)
        group.reload()
    return _to_response(group, viewer=current_user)


def leave_group(group_id: str, current_user: User) -> dict:
    group = _get_as_member(group_id, current_user)
    if str(group.created_by.id) == str(current_user.id):
        raise errors.bad_request(
            "The creator can't leave — delete the group instead",
        )
    _strip_group_from_items(group, current_user)
    _strip_vouches(group, current_user)
    group.update(pull__members=current_user)
    return {"detail": "Left the group"}


def delete_group(group_id: str, current_user: User) -> None:
    group = _get_as_member(group_id, current_user)
    if str(group.created_by.id) != str(current_user.id):
        raise errors.forbidden("Only the creator can delete the group")
    for member in group.members:
        _strip_group_from_items(group, member)
    group.delete()


def admin_delete_group(group_id: str) -> None:
    """Moderation action — deletes any group regardless of creator, unlike
    delete_group above which only the creator can invoke."""
    group = Group.objects(id=group_id).first()
    if not group:
        raise errors.not_found("Group not found")
    for member in group.members:
        _strip_group_from_items(group, member)
    group.delete()


def admin_remove_member(group_id: str, user_id: str) -> GroupResponse:
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
    group.update(pull__members=member)
    group.reload()
    return _to_response(group)


def vouch_for_member(
    group_id: str,
    user_id: str,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> GroupResponse:
    """Confirms `current_user` personally knows the member at `user_id`,
    within this group. Idempotent — re-vouching is a no-op, not an error."""
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
        group.update(push__vouches=Vouch(voucher=current_user, vouched_for=target))
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
            background_tasks.add_task(
                notification_service.create_notification,
                target,
                "group_vouch",
                f"{current_user.name} confirmou que conhece você",
                f"No grupo {group.name}",
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
    return _to_response(group, viewer=current_user)
