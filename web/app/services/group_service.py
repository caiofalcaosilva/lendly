import secrets
from typing import List

from fastapi import HTTPException, status

from app.models.group import Group
from app.models.item import Item
from app.models.user import User
from app.schemas.group import GroupCreate, GroupMemberResponse, GroupResponse, GroupSummary


def _member_response(user: User) -> GroupMemberResponse:
    return GroupMemberResponse(id=str(user.id), name=user.name, average_rating=user.average_rating)


def _to_response(group: Group) -> GroupResponse:
    return GroupResponse(
        id=str(group.id),
        name=group.name,
        description=group.description,
        invite_code=group.invite_code,
        member_count=len(group.members),
        members=[_member_response(m) for m in group.members],
        created_by=str(group.created_by.id),
        created_at=group.created_at,
    )


def _to_summary(group: Group) -> GroupSummary:
    return GroupSummary(id=str(group.id), name=group.name, member_count=len(group.members))


def _get_as_member(group_id: str, current_user: User) -> Group:
    group = Group.objects(id=group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if not any(str(m.id) == str(current_user.id) for m in group.members):
        # Groups are private — non-members get the same 404 a nonexistent
        # group would, rather than 403 (don't confirm the group exists).
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return group


def _strip_group_from_items(group: Group, user: User) -> None:
    """Removes `group` from this user's items' `groups` list, and — to avoid
    orphaning an item that's neither public nor in any remaining group —
    forces it back to public if that would otherwise leave it invisible."""
    for item in Item.objects(owner=user, groups=group):
        remaining = [g for g in item.groups if str(g.id) != str(group.id)]
        updates = {"groups": remaining}
        if not remaining and not item.is_public:
            updates["is_public"] = True
        item.update(**updates)


def create_group(data: GroupCreate, current_user: User) -> GroupResponse:
    group = Group(
        name=data.name,
        description=data.description,
        invite_code=secrets.token_urlsafe(12),
        created_by=current_user,
        members=[current_user],
    )
    group.save()
    return _to_response(group)


def get_my_groups(current_user: User) -> List[GroupSummary]:
    return [_to_summary(g) for g in Group.objects(members=current_user).order_by("name")]


def _get_group_readable(group_id: str, current_user: User) -> Group:
    """Like _get_as_member, but also lets an admin read a group they're not
    in — used only by get_group (read-only). leave_group/delete_group keep
    using the stricter _get_as_member, since bypassing membership there
    doesn't make sense (an admin "leaving" a group they were never in)."""
    group = Group.objects(id=group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    is_member = any(str(m.id) == str(current_user.id) for m in group.members)
    if not is_member and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return group


def get_group(group_id: str, current_user: User) -> GroupResponse:
    group = _get_group_readable(group_id, current_user)
    return _to_response(group)


def list_all_groups() -> List[GroupSummary]:
    """Admin-only — every group on the platform, not just ones the caller
    belongs to. See routers/admin.py."""
    return [_to_summary(g) for g in Group.objects().order_by("name")]


def join_group(invite_code: str, current_user: User) -> GroupResponse:
    group = Group.objects(invite_code=invite_code).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code")
    # Admins never become group members (see roadmap "Restrições de conta
    # administrativa") — they can already view any group via _get_group_readable,
    # so an invite link just takes them straight to that read-only view
    # instead of adding them to the member list.
    is_member = any(str(m.id) == str(current_user.id) for m in group.members)
    if not is_member and not current_user.is_admin:
        group.update(push__members=current_user)
        group.reload()
    return _to_response(group)


def leave_group(group_id: str, current_user: User) -> dict:
    group = _get_as_member(group_id, current_user)
    if str(group.created_by.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The creator can't leave — delete the group instead",
        )
    _strip_group_from_items(group, current_user)
    group.update(pull__members=current_user)
    return {"detail": "Left the group"}


def delete_group(group_id: str, current_user: User) -> None:
    group = _get_as_member(group_id, current_user)
    if str(group.created_by.id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator can delete the group"
        )
    for member in group.members:
        _strip_group_from_items(group, member)
    group.delete()


def admin_delete_group(group_id: str) -> None:
    """Moderation action — deletes any group regardless of creator, unlike
    delete_group above which only the creator can invoke."""
    group = Group.objects(id=group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    for member in group.members:
        _strip_group_from_items(group, member)
    group.delete()


def admin_remove_member(group_id: str, user_id: str) -> GroupResponse:
    """Moderation action — kicks a member out of a group. The creator can't
    be removed this way (mirrors leave_group's block); delete the group
    instead."""
    group = Group.objects(id=group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    member = next((m for m in group.members if str(m.id) == user_id), None)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in this group")
    if str(group.created_by.id) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível remover o criador — exclua o grupo em vez disso",
        )
    _strip_group_from_items(group, member)
    group.update(pull__members=member)
    group.reload()
    return _to_response(group)
