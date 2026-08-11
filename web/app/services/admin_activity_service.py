from datetime import datetime

from mongoengine import QuerySet

from app.models.activity import Activity
from app.schemas.activity import ActivityActor, ActivityResource, AdminActivityResponse


def build_queryset(
    recipient_id: str | None = None,
    actor_id: str | None = None,
    event: str | None = None,
    resource_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> QuerySet:
    """Shared by list_activities below and
    admin_export_service.export_activities_csv, so the two never drift on
    what a given set of filters means."""
    qs = Activity.objects()
    if recipient_id:
        qs = qs.filter(recipient=recipient_id)
    if actor_id:
        qs = qs.filter(actor=actor_id)
    if event:
        qs = qs.filter(event=event)
    if resource_type:
        qs = qs.filter(resource_type=resource_type)
    if date_from:
        qs = qs.filter(created_at__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__lte=date_to)
    return qs


def _to_response(activity: Activity) -> AdminActivityResponse:
    actor = None
    if activity.actor:
        actor = ActivityActor(
            id=str(activity.actor.id), name=activity.actor_name or activity.actor.name
        )
    return AdminActivityResponse(
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
        recipient=ActivityActor(
            id=str(activity.recipient.id), name=activity.recipient.name
        ),
    )


def list_activities(
    recipient_id: str | None = None,
    actor_id: str | None = None,
    event: str | None = None,
    resource_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    before_id: str | None = None,
    limit: int = 20,
) -> list[AdminActivityResponse]:
    """Cross-user search for admins — unlike activity_service.list_activities,
    never scoped to a single recipient. See app/models/activity.py's
    trailing four indexes, added specifically for the filter combinations
    this supports."""
    qs = build_queryset(
        recipient_id, actor_id, event, resource_type, date_from, date_to
    )
    if before_id:
        qs = qs.filter(id__lt=before_id)
    activities = qs.order_by("-id").limit(limit).select_related(max_depth=1)
    return [_to_response(a) for a in activities]
