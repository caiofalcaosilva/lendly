import logging
import secrets

from fastapi import HTTPException, status
from mongoengine import Q

from app.models.group import Group
from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.user import AccountDeleteRequest
from app.services import group_service
from app.utils.security import hash_password, verify_password
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

_ACTIVE_LOAN_STATUSES = ["pending", "accepted", "in_progress"]


def delete_account(data: AccountDeleteRequest, current_user: User) -> None:
    """Anonymizes and deactivates the account — doesn't hard-delete the
    document, since items/reviews/messages belonging to *other* users
    reference it and must keep working (showing "Usuário removido")."""
    if not verify_password(data.password, current_user.password_hash):
        # 400, not 401 — a 401 here would trip the frontend's generic
        # "session expired" interceptor (which retries after a token refresh,
        # then evicts on a second failure) instead of surfacing this as a
        # simple form validation error. Same convention already used by
        # disable_totp's "Código inválido" below.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Senha incorreta"
        )

    has_active_loan = LoanRequest.objects(
        Q(requester=current_user) | Q(owner=current_user),
        status__in=_ACTIVE_LOAN_STATUSES,
    ).first()
    if has_active_loan:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Finalize ou cancele seus empréstimos em andamento antes de "
                "excluir a conta"
            ),
        )

    Item.objects(owner=current_user).update(is_active=False, updated_at=utcnow())

    for group in Group.objects(members=current_user):
        if str(group.created_by.id) == str(current_user.id):
            group_service.delete_group(str(group.id), current_user)
        else:
            group_service.leave_group(str(group.id), current_user)

    current_user.update(
        name="Usuário removido",
        email=f"deleted-{current_user.id}@lendly.invalid",
        password_hash=hash_password(secrets.token_urlsafe(32)),
        phone=None,
        zip_code=None,
        street=None,
        number=None,
        complement=None,
        neighborhood=None,
        city=None,
        state=None,
        latitude=None,
        longitude=None,
        company_name=None,
        trade_name=None,
        # $unset, not $set null — cnpj has a sparse unique index, and unlike
        # a plain insert (where mongoengine omits None fields entirely), an
        # explicit `.update(cnpj=None)` here would write a literal null,
        # which sparse indexes still track and can collide on.
        unset__cnpj=1,
        business_category=None,
        business_phone=None,
        business_hours=None,
        website=None,
        totp_secret=None,
        totp_enabled=False,
        trusted_devices=[],
        refresh_sessions=[],
        is_active=False,
        updated_at=utcnow(),
    )
    logger.info("account deleted", extra={"user_id": str(current_user.id)})
