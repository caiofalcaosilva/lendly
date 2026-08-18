from fastapi import BackgroundTasks

from app.models.group import Group
from app.models.item import Item
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportResponse
from app.services import activity_service, group_service
from app.utils import errors
from app.utils.time import utcnow


def _safe_reported_group(report: Report) -> Group | None:
    """report.reported_group dereferences on access — safe for the create/
    dismiss paths, but action_report can delete the group as its "action",
    after which the reference is dangling. Swallowing here (rather than
    letting a DoesNotExist bubble up) keeps a report readable/listable
    even after its target group is gone."""
    try:
        return report.reported_group
    except Exception:
        return None


def _record_report_activity(
    report: Report, event: str, actor: User, target_title: str | None = None
) -> None:
    if target_title is None:
        if report.item:
            target_title = report.item.title
        elif report.reported_user:
            target_title = report.reported_user.name
        else:
            group = _safe_reported_group(report)
            target_title = group.name if group else None
    activity_service.record(
        recipient=report.reporter,
        event=event,
        actor=actor,
        resource_type="report",
        resource_id=str(report.id),
        resource_title=target_title,
    )


def _to_response(report: Report) -> ReportResponse:
    group = _safe_reported_group(report)
    return ReportResponse(
        id=str(report.id),
        reporter_id=str(report.reporter.id),
        reporter_name=report.reporter.name,
        item_id=str(report.item.id) if report.item else None,
        item_title=report.item.title if report.item else None,
        reported_user_id=str(report.reported_user.id) if report.reported_user else None,
        reported_user_name=report.reported_user.name if report.reported_user else None,
        reported_group_id=str(group.id) if group else None,
        reported_group_name=group.name if group else None,
        reason=report.reason,
        description=report.description,
        status=report.status,
        reviewed_by_name=report.reviewed_by.name if report.reviewed_by else None,
        reviewed_at=report.reviewed_at,
        created_at=report.created_at,
    )


def create_report(data: ReportCreate, current_user: User) -> ReportResponse:
    item = None
    reported_user = None
    reported_group = None

    if data.item_id:
        item = Item.objects(id=data.item_id, is_active=True).first()
        if not item:
            raise errors.not_found("Item not found")
    elif data.reported_user_id:
        reported_user = User.objects(id=data.reported_user_id, is_active=True).first()
        if not reported_user:
            raise errors.not_found("User not found")
        if str(reported_user.id) == str(current_user.id):
            raise errors.bad_request("Cannot report yourself")
    else:
        reported_group = Group.objects(id=data.reported_group_id).first()
        if not reported_group:
            raise errors.not_found("Group not found")

    # One pending report per (reporter, target) at a time — resubmitting
    # while the first is still unreviewed would just clutter the admin
    # queue with duplicates of the same complaint. A new report is fine
    # once the earlier one has actually been reviewed.
    duplicate = Report.objects(
        reporter=current_user,
        item=item,
        reported_user=reported_user,
        reported_group=reported_group,
        status="pending",
    ).first()
    if duplicate:
        raise errors.bad_request(
            "You already have a pending report for this — wait for it to be reviewed"
        )

    report = Report(
        reporter=current_user,
        item=item,
        reported_user=reported_user,
        reported_group=reported_group,
        reason=data.reason,
        description=data.description,
    )
    report.save()
    _record_report_activity(report, "report.filed", current_user)
    return _to_response(report)


def list_reports(
    status_filter: str | None, skip: int = 0, limit: int = 100
) -> list[ReportResponse]:
    qs = Report.objects()
    if status_filter:
        qs = qs.filter(status=status_filter)
    return [_to_response(r) for r in qs.order_by("-created_at").skip(skip).limit(limit)]


def _get_pending_report(report_id: str) -> Report:
    report = Report.objects(id=report_id).first()
    if not report:
        raise errors.not_found("Report not found")
    if report.status != "pending":
        raise errors.bad_request("Report already reviewed")
    return report


def dismiss_report(report_id: str, admin: User) -> ReportResponse:
    report = _get_pending_report(report_id)
    report.update(
        status="dismissed", reviewed_by=admin, reviewed_at=utcnow(), updated_at=utcnow()
    )
    report.reload()
    _record_report_activity(report, "admin.report_dismissed", admin)
    return _to_response(report)


def action_report(
    report_id: str, admin: User, background_tasks: BackgroundTasks | None = None
) -> ReportResponse:
    report = _get_pending_report(report_id)
    deleted_group_id = None
    deleted_group_title = None
    if report.item:
        report.item.update(is_active=False)
    elif report.reported_user:
        report.reported_user.update(is_active=False)
    else:
        # Group has no is_active-style soft flag — "actioning" a group
        # report deletes it outright, same as the creator's own delete
        # path (admin_delete_group also unshares its items and notifies
        # every member).
        group = _safe_reported_group(report)
        if group:
            deleted_group_id = str(group.id)
            deleted_group_title = group.name

    report.update(
        status="actioned", reviewed_by=admin, reviewed_at=utcnow(), updated_at=utcnow()
    )
    # Reload — and let it dereference reported_group — before deleting the
    # group below, or the reload itself raises DoesNotExist on a dangling
    # reference. Mongoengine caches the dereferenced doc on this instance,
    # so _to_response still shows the (now-deleted) group's name below.
    report.reload()
    if deleted_group_id:
        group_service.admin_delete_group(deleted_group_id, admin, background_tasks)
    _record_report_activity(
        report, "admin.report_actioned", admin, target_title=deleted_group_title
    )
    return _to_response(report)
