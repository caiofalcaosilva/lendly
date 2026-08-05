from app.models.item import Item
from app.models.report import Report
from app.models.user import User
from app.models.verification import VerificationSubmission
from app.schemas.admin_actions import AdminActionEntry

# How far back each source query looks before merging + sorting.
_SOURCE_LIMIT = 100


def get_admin_actions(limit: int = 50) -> list[AdminActionEntry]:
    entries: list[AdminActionEntry] = []

    reports = (
        Report.objects(status__in=["dismissed", "actioned"], reviewed_by__ne=None)
        .order_by("-reviewed_at")
        .limit(_SOURCE_LIMIT)
        .select_related(max_depth=1)
    )
    for r in reports:
        target_label = (
            r.item.title
            if r.item
            else (r.reported_user.name if r.reported_user else "—")
        )
        target_id = (
            str(r.item.id)
            if r.item
            else (str(r.reported_user.id) if r.reported_user else "")
        )
        entries.append(
            AdminActionEntry(
                action_type="report_actioned"
                if r.status == "actioned"
                else "report_dismissed",
                actor_name=r.reviewed_by.name,
                target_label=target_label,
                target_id=target_id,
                target_kind="item" if r.item else "user",
                detail=f"Motivo: {r.reason}",
                occurred_at=r.reviewed_at,
            )
        )

    verifications = (
        VerificationSubmission.objects(
            status__in=["approved", "rejected"], reviewed_by__ne=None
        )
        .order_by("-reviewed_at")
        .limit(_SOURCE_LIMIT)
        .select_related(max_depth=1)
    )
    for v in verifications:
        entries.append(
            AdminActionEntry(
                action_type="verification_approved"
                if v.status == "approved"
                else "verification_rejected",
                actor_name=v.reviewed_by.name,
                target_label=v.user.name,
                target_id=str(v.user.id),
                target_kind="user",
                detail=v.rejection_reason,
                occurred_at=v.reviewed_at,
            )
        )

    changed_users = (
        User.objects(status_changed_by__ne=None)
        .order_by("-status_changed_at")
        .limit(_SOURCE_LIMIT)
        .select_related(max_depth=1)
    )
    for u in changed_users:
        entries.append(
            AdminActionEntry(
                action_type="user_activated" if u.is_active else "user_deactivated",
                actor_name=u.status_changed_by.name,
                target_label=u.name,
                target_id=str(u.id),
                target_kind="user",
                occurred_at=u.status_changed_at,
            )
        )

    changed_items = (
        Item.objects(status_changed_by__ne=None)
        .order_by("-status_changed_at")
        .limit(_SOURCE_LIMIT)
        .select_related(max_depth=1)
    )
    for i in changed_items:
        entries.append(
            AdminActionEntry(
                action_type="item_activated" if i.is_active else "item_deactivated",
                actor_name=i.status_changed_by.name,
                target_label=i.title,
                target_id=str(i.id),
                target_kind="item",
                occurred_at=i.status_changed_at,
            )
        )

    admin_changed_users = (
        User.objects(admin_status_changed_by__ne=None)
        .order_by("-admin_status_changed_at")
        .limit(_SOURCE_LIMIT)
        .select_related(max_depth=1)
    )
    for u in admin_changed_users:
        entries.append(
            AdminActionEntry(
                action_type="user_promoted" if u.is_admin else "user_demoted",
                actor_name=u.admin_status_changed_by.name,
                target_label=u.name,
                target_id=str(u.id),
                target_kind="user",
                occurred_at=u.admin_status_changed_at,
            )
        )

    entries.sort(key=lambda e: e.occurred_at, reverse=True)
    return entries[:limit]
