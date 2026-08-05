import logging

from fastapi import HTTPException, status
from mongoengine import Q

from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.admin_users import AdminUserSummary
from app.schemas.bulk import BulkActionResult
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
        trade_name=user.trade_name,
        city=user.city,
        neighborhood=user.neighborhood,
        is_active=user.is_active,
        is_admin=user.is_admin or False,
        is_verified=user.is_verified or False,
        identity_status=user.identity_status or "none",
        average_rating=user.average_rating,
        rating_count=user.rating_count,
        finished_loans_count=user.finished_loans_count or 0,
        created_at=user.created_at,
    )


def list_users(search: str | None, skip: int, limit: int) -> list[AdminUserSummary]:
    qs = User.objects()
    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(email__icontains=search)
            | Q(trade_name__icontains=search)
        )
    return [_to_summary(u) for u in qs.order_by("-created_at").skip(skip).limit(limit)]


def _get_user(user_id: str) -> User:
    user = User.objects(id=user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


def get_user(user_id: str) -> AdminUserSummary:
    return _to_summary(_get_user(user_id))


def deactivate_user(user_id: str, admin: User) -> AdminUserSummary:
    user = _get_user(user_id)
    if str(user.id) == str(admin.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível desativar sua própria conta",
        )

    has_active_loan = LoanRequest.objects(
        Q(requester=user) | Q(owner=user), status__in=_ACTIVE_LOAN_STATUSES
    ).first()
    if has_active_loan:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Usuário tem empréstimo em andamento — resolva antes de "
                "desativar a conta"
            ),
        )

    user.update(is_active=False, status_changed_by=admin, status_changed_at=utcnow())
    user.reload()
    return _to_summary(user)


def activate_user(user_id: str, admin: User) -> AdminUserSummary:
    user = _get_user(user_id)
    user.update(is_active=True, status_changed_by=admin, status_changed_at=utcnow())
    user.reload()
    return _to_summary(user)


def bulk_activate_users(user_ids: list[str], admin: User) -> BulkActionResult:
    return run_bulk(user_ids, admin, activate_user)


def bulk_deactivate_users(user_ids: list[str], admin: User) -> BulkActionResult:
    return run_bulk(user_ids, admin, deactivate_user)


def promote_user(user_id: str, admin: User) -> AdminUserSummary:
    user = _get_user(user_id)
    if str(user.id) == str(admin.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível alterar seu próprio nível de admin",
        )
    user.update(
        is_admin=True,
        admin_status_changed_by=admin,
        admin_status_changed_at=utcnow(),
    )
    user.reload()
    logger.info(
        "user promoted to admin",
        extra={"admin_id": str(admin.id), "target_user_id": user_id},
    )
    return _to_summary(user)


def demote_user(user_id: str, admin: User) -> AdminUserSummary:
    user = _get_user(user_id)
    if str(user.id) == str(admin.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível alterar seu próprio nível de admin",
        )
    user.update(
        is_admin=False,
        admin_status_changed_by=admin,
        admin_status_changed_at=utcnow(),
    )
    user.reload()
    logger.info(
        "user demoted from admin",
        extra={"admin_id": str(admin.id), "target_user_id": user_id},
    )
    return _to_summary(user)
