from app.models.item import Item
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportResponse
from app.services import activity_service
from app.utils import errors
from app.utils.time import utcnow


def _record_report_activity(report: Report, event: str, admin: User) -> None:
    target_title = report.item.title if report.item else report.reported_user.name
    activity_service.record(
        recipient=report.reporter,
        event=event,
        actor=admin,
        resource_type="report",
        resource_id=str(report.id),
        resource_title=target_title,
    )


def _to_response(report: Report) -> ReportResponse:
    return ReportResponse(
        id=str(report.id),
        reporter_id=str(report.reporter.id),
        reporter_name=report.reporter.name,
        item_id=str(report.item.id) if report.item else None,
        item_title=report.item.title if report.item else None,
        reported_user_id=str(report.reported_user.id) if report.reported_user else None,
        reported_user_name=report.reported_user.name if report.reported_user else None,
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

    if data.item_id:
        item = Item.objects(id=data.item_id, is_active=True).first()
        if not item:
            raise errors.not_found("Item not found")
    else:
        reported_user = User.objects(id=data.reported_user_id, is_active=True).first()
        if not reported_user:
            raise errors.not_found("User not found")
        if str(reported_user.id) == str(current_user.id):
            raise errors.bad_request("Cannot report yourself")

    report = Report(
        reporter=current_user,
        item=item,
        reported_user=reported_user,
        reason=data.reason,
        description=data.description,
    )
    report.save()
    return _to_response(report)


def list_reports(status_filter: str | None) -> list[ReportResponse]:
    qs = Report.objects()
    if status_filter:
        qs = qs.filter(status=status_filter)
    return [_to_response(r) for r in qs.order_by("-created_at")]


def _get_pending_report(report_id: str) -> Report:
    report = Report.objects(id=report_id).first()
    if not report:
        raise errors.not_found("Report not found")
    if report.status != "pending":
        raise errors.bad_request("Report already reviewed")
    return report


def dismiss_report(report_id: str, admin: User) -> ReportResponse:
    report = _get_pending_report(report_id)
    report.update(status="dismissed", reviewed_by=admin, reviewed_at=utcnow())
    report.reload()
    _record_report_activity(report, "admin.report_dismissed", admin)
    return _to_response(report)


def action_report(report_id: str, admin: User) -> ReportResponse:
    report = _get_pending_report(report_id)
    if report.item:
        report.item.update(is_active=False)
    elif report.reported_user:
        report.reported_user.update(is_active=False)
    report.update(status="actioned", reviewed_by=admin, reviewed_at=utcnow())
    report.reload()
    _record_report_activity(report, "admin.report_actioned", admin)
    return _to_response(report)
