from fastapi import BackgroundTasks

from app.models.group import Group
from app.models.group_post import GroupPost
from app.models.user import User
from app.schemas.group_post import GroupPostAuthor, GroupPostCreate, GroupPostResponse
from app.utils import errors
from app.ws_manager import group_post_manager


def _to_response(post: GroupPost) -> GroupPostResponse:
    return GroupPostResponse(
        id=str(post.id),
        group_id=str(post.group.id),
        author=GroupPostAuthor(id=str(post.author.id), name=post.author.name),
        body=post.body,
        created_at=post.created_at,
    )


def _get_as_member(group_id: str, current_user: User) -> Group:
    group = Group.objects(id=group_id).first()
    if not group:
        raise errors.not_found("Group not found")
    if not any(str(m.id) == str(current_user.id) for m in group.members):
        raise errors.not_found("Group not found")
    return group


def _get_group_readable(group_id: str, current_user: User) -> Group:
    """Like _get_as_member, but also lets an admin read a group they're not
    in — same reasoning as group_service.get_group and
    item_service.list_group_items, so the mural doesn't 404 for an admin
    viewing a group's detail page read-only."""
    group = Group.objects(id=group_id).first()
    if not group:
        raise errors.not_found("Group not found")
    is_member = any(str(m.id) == str(current_user.id) for m in group.members)
    if not is_member and not current_user.is_admin:
        raise errors.not_found("Group not found")
    return group


def _is_creator_or_moderator(group: Group, user: User) -> bool:
    return str(group.created_by.id) == str(user.id) or any(
        str(m.id) == str(user.id) for m in group.moderators
    )


def create_post(
    group_id: str,
    data: GroupPostCreate,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> GroupPostResponse:
    group = _get_as_member(group_id, current_user)
    post = GroupPost(group=group, author=current_user, body=data.body)
    post.save()
    response = _to_response(post)
    if background_tasks:
        background_tasks.add_task(
            group_post_manager.broadcast,
            group_id,
            {"type": "created", "post": response.model_dump(mode="json")},
        )
    return response


def list_posts(
    group_id: str, current_user: User, before_id: str | None, limit: int
) -> list[GroupPostResponse]:
    """Cursor-based on `id`, same reasoning as notification/activity feeds —
    newest first, stable across pages even as new posts land."""
    _get_group_readable(group_id, current_user)
    qs = GroupPost.objects(group=group_id)
    if before_id:
        qs = qs.filter(id__lt=before_id)
    posts = qs.order_by("-id").limit(limit)
    return [_to_response(p) for p in posts]


def delete_post(
    group_id: str,
    post_id: str,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> None:
    group = _get_as_member(group_id, current_user)
    post = GroupPost.objects(id=post_id, group=group).first()
    if not post:
        raise errors.not_found("Post not found")
    if str(post.author.id) != str(current_user.id) and not _is_creator_or_moderator(
        group, current_user
    ):
        raise errors.forbidden(
            "Only the author, creator, or a moderator can delete this post"
        )
    post.delete()
    if background_tasks:
        background_tasks.add_task(
            group_post_manager.broadcast,
            group_id,
            {"type": "deleted", "post_id": post_id},
        )
