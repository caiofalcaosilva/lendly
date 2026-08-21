import logging

from mongoengine import Q

from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.admin_users import AdminUserSummary
from app.schemas.bulk import BulkActionResult
from app.services import activity_service
from app.utils import errors
from app.utils.bulk import run_bulk
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

# Same statuses auth_service.delete_account guards against — an account
# with a loan mid-flight shouldn't be locked out from under the other party.
_ACTIVE_LOAN_STATUSES = ["pending", "accepted", "in_progress"]


def _to_summary(user: User) -> AdminUserSummary:
    return AdminUserSummary(
        id=str(user.id),
        name=user.name,
        email=user.email,
        account_type=user.account_type or "individual",
        trade_name=user.business_profile.trade_name if user.business_profile else None,
        city=user.address.city,
        neighborhood=user.address.neighborhood,
        is_active=user.is_active,
        is_admin=user.is_admin or False,
        is_verified=user.is_verified or False,
        identity_status=user.identity_status or "none",
        average_rating=user.reputation.average_rating,
        rating_count=user.reputation.rating_count,
        finished_loans_count=user.reputation.finished_loans_count or 0,
        created_at=user.created_at,
    )


def list_users(search: str | None, skip: int, limit: int) -> list[AdminUserSummary]:
    # Excludes the system sentinel account (system_account_service) — it
    # never signed up and has nothing an admin would act on here.
    qs = User.objects(is_system_account__ne=True)
    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(email__icontains=search)
            | Q(business_profile__trade_name__icontains=search)
        )
    return [_to_summary(u) for u in qs.order_by("-created_at").skip(skip).limit(limit)]


def _get_user(user_id: str) -> User:
    user = User.objects(id=user_id).first()
    if not user:
        raise errors.not_found("User not found")
    return user


def get_user(user_id: str) -> AdminUserSummary:
    return _to_summary(_get_user(user_id))


def deactivate_user(user_id: str, admin: User) -> AdminUserSummary:
    user = _get_user(user_id)
    if str(user.id) == str(admin.id):
        raise errors.bad_request(
            "Não é possível desativar sua própria conta",
        )

    has_active_loan = LoanRequest.objects(
        Q(requester=user) | Q(owner=user), status__in=_ACTIVE_LOAN_STATUSES
    ).first()
    if has_active_loan:
        raise errors.conflict(
            "Usuário tem empréstimo em andamento — resolva antes de desativar a conta"
        )

    user.update(is_active=False, status_changed_by=admin, status_changed_at=utcnow())
    user.reload()
    activity_service.record(
        recipient=user,
        event="admin.user_deactivated",
        actor=admin,
        resource_type="user",
        resource_id=str(user.id),
    )
    return _to_summary(user)


def activate_user(user_id: str, admin: User) -> AdminUserSummary:
    user = _get_user(user_id)
    user.update(is_active=True, status_changed_by=admin, status_changed_at=utcnow())
    user.reload()
    activity_service.record(
        recipient=user,
        event="admin.user_activated",
        actor=admin,
        resource_type="user",
        resource_id=str(user.id),
    )
    return _to_summary(user)


def bulk_activate_users(user_ids: list[str], admin: User) -> BulkActionResult:
    return run_bulk(user_ids, admin, activate_user)


def bulk_deactivate_users(user_ids: list[str], admin: User) -> BulkActionResult:
    return run_bulk(user_ids, admin, deactivate_user)


def promote_user(user_id: str, admin: User) -> AdminUserSummary:
    user = _get_user(user_id)
    if str(user.id) == str(admin.id):
        raise errors.bad_request(
            "Não é possível alterar seu próprio nível de admin",
        )
    user.update(
        is_admin=True,
        admin_status_changed_by=admin,
        admin_status_changed_at=utcnow(),
    )
    user.reload()
    activity_service.record(
        recipient=user,
        event="admin.user_promoted",
        actor=admin,
        resource_type="user",
        resource_id=str(user.id),
    )
    logger.info(
        "user promoted to admin",
        extra={"admin_id": str(admin.id), "target_user_id": user_id},
    )
    return _to_summary(user)


def demote_user(user_id: str, admin: User) -> AdminUserSummary:
    user = _get_user(user_id)
    if str(user.id) == str(admin.id):
        raise errors.bad_request(
            "Não é possível alterar seu próprio nível de admin",
        )
    user.update(
        is_admin=False,
        admin_status_changed_by=admin,
        admin_status_changed_at=utcnow(),
    )
    user.reload()
    activity_service.record(
        recipient=user,
        event="admin.user_demoted",
        actor=admin,
        resource_type="user",
        resource_id=str(user.id),
    )
    logger.info(
        "user demoted from admin",
        extra={"admin_id": str(admin.id), "target_user_id": user_id},
    )
    return _to_summary(user)
