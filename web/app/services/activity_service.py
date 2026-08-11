import logging

from app.models.activity import Activity
from app.models.user import User
from app.schemas.activity import ActivityActor, ActivityResource, ActivityResponse

logger = logging.getLogger(__name__)


def _to_response(activity: Activity) -> ActivityResponse:
    actor = None
    if activity.actor:
        actor = ActivityActor(
            id=str(activity.actor.id), name=activity.actor_name or activity.actor.name
        )
    return ActivityResponse(
        id=str(activity.id),
        event=activity.event,
        actor=actor,
        resource=ActivityResource(
            type=activity.resource_type,
            id=activity.resource_id,
            title=activity.resource_title,
        ),
        metadata=activity.metadata or {},
        created_at=activity.created_at,
    )


def record(
    recipient: User,
    event: str,
    resource_type: str,
    resource_id: str,
    actor: User | None = None,
    resource_title: str | None = None,
    metadata: dict | None = None,
) -> None:
    """Writes one append-only activity row for `recipient`. Best-effort by
    design — a business action (accepting a request, releasing a payment...)
    must never fail because this insert did, so failures are logged and
    swallowed here rather than raised. Call once per recipient when an
    event reaches more than one person (see call sites), never with a
    shared "visible to" list.

    See docs/historico-de-atividades.md for the full event catalog and the
    metadata content rules."""
    try:
        Activity(
            recipient=recipient,
            event=event,
            actor=actor,
            actor_name=actor.name if actor else None,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_title=resource_title,
            metadata=metadata or {},
        ).save()
    except Exception:
        logger.exception(
            "failed to record activity",
            extra={
                "event": event,
                "resource_type": resource_type,
                "resource_id": resource_id,
            },
        )


def list_activities(
    current_user: User,
    before_id: str | None,
    limit: int,
    event: str | None = None,
    resource_type: str | None = None,
) -> list[ActivityResponse]:
    """Cursor-based on `id`, not `created_at` — same reasoning as
    notification_service.list_notifications: ObjectId only has
    second-level precision, so sorting and cursoring on the same field
    keeps a row from landing on two pages (or none) at the boundary."""
    qs = Activity.objects(recipient=current_user)
    if event:
        qs = qs.filter(event=event)
    if resource_type:
        qs = qs.filter(resource_type=resource_type)
    if before_id:
        qs = qs.filter(id__lt=before_id)
    activities = qs.order_by("-id").limit(limit).select_related(max_depth=1)
    return [_to_response(a) for a in activities]
