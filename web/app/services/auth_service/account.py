import logging
import secrets
from datetime import timedelta

from fastapi import BackgroundTasks
from mongoengine import Q

from app.models.group import Group
from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.user import (
    AccountDeleteRequest,
    EmailChangeRequest,
    PasswordChangeRequest,
    UserResponse,
)
from app.services import activity_service, email_service, group_service
from app.services.auth_service._common import user_to_response
from app.services.platform_settings_service import get_settings as get_platform_settings
from app.utils import errors
from app.utils.security import hash_password, verify_password
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

_ACTIVE_LOAN_STATUSES = ["pending", "accepted", "in_progress"]


def delete_account(data: AccountDeleteRequest, current_user: User) -> None:
    """Anonymizes and deactivates the account — doesn't hard-delete the
    document, since items/reviews/messages belonging to *other* users
    reference it and must keep working (showing "Usuário removido")."""
    if not verify_password(data.password, current_user.password_hash):
        # 400, not 401 — a 401 would trip the frontend's session-expired
        # interceptor instead of showing a plain form error.
        raise errors.bad_request("Senha incorreta")

    has_active_loan = LoanRequest.objects(
        Q(requester=current_user) | Q(owner=current_user),
        status__in=_ACTIVE_LOAN_STATUSES,
    ).first()
    if has_active_loan:
        raise errors.conflict(
            "Finalize ou cancele seus empréstimos em andamento antes de excluir a conta"
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
        # $unset, not $set null — cnpj's sparse unique index still tracks
        # (and can collide on) an explicit null.
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


def pause_account(current_user: User) -> UserResponse:
    """Hides every active item from search and blocks new requests on them,
    without touching login or any other data — reversible any time via
    resume_account. Only items active *before* pausing get the
    paused_by_owner flag, so resume doesn't reactivate something the owner
    had already turned off themselves."""
    if current_user.is_paused:
        raise errors.bad_request("Conta já está pausada")

    Item.objects(owner=current_user, is_active=True).update(
        is_active=False, paused_by_owner=True, updated_at=utcnow()
    )
    current_user.update(is_paused=True, updated_at=utcnow())
    current_user.reload()
    activity_service.record(
        recipient=current_user,
        event="account.paused",
        actor=current_user,
        resource_type="user",
        resource_id=str(current_user.id),
    )
    logger.info("account paused", extra={"user_id": str(current_user.id)})
    return user_to_response(current_user)


def resume_account(current_user: User) -> UserResponse:
    if not current_user.is_paused:
        raise errors.bad_request("Conta não está pausada")

    Item.objects(owner=current_user, paused_by_owner=True).update(
        is_active=True, paused_by_owner=False, updated_at=utcnow()
    )
    current_user.update(is_paused=False, updated_at=utcnow())
    current_user.reload()
    activity_service.record(
        recipient=current_user,
        event="account.resumed",
        actor=current_user,
        resource_type="user",
        resource_id=str(current_user.id),
    )
    logger.info("account resumed", extra={"user_id": str(current_user.id)})
    return user_to_response(current_user)


def change_password(data: PasswordChangeRequest, current_user: User) -> UserResponse:
    if not verify_password(data.current_password, current_user.password_hash):
        raise errors.bad_request("Senha atual incorreta")

    current_user.update(
        password_hash=hash_password(data.new_password),
        refresh_sessions=[],
        updated_at=utcnow(),
    )
    current_user.reload()
    activity_service.record(
        recipient=current_user,
        event="account.password_changed",
        actor=current_user,
        resource_type="user",
        resource_id=str(current_user.id),
    )
    logger.info("password changed", extra={"user_id": str(current_user.id)})
    return user_to_response(current_user)


def change_email(
    data: EmailChangeRequest, current_user: User, background_tasks: BackgroundTasks
) -> UserResponse:
    if not verify_password(data.password, current_user.password_hash):
        raise errors.bad_request("Senha incorreta")

    if User.objects(email=data.new_email, id__ne=current_user.id).first():
        raise errors.conflict("Email already registered")

    token = secrets.token_urlsafe(32)
    current_user.update(
        email=data.new_email,
        is_verified=False,
        email_verification_token=token,
        email_verification_expires=utcnow()
        + timedelta(hours=get_platform_settings().email_verification_expire_hours),
        updated_at=utcnow(),
    )
    current_user.reload()
    activity_service.record(
        recipient=current_user,
        event="account.email_changed",
        actor=current_user,
        resource_type="user",
        resource_id=str(current_user.id),
        metadata={"new_email": current_user.email},
    )

    background_tasks.add_task(
        email_service.send_verification_email,
        current_user.email,
        current_user.name,
        token,
    )
    logger.info("email changed", extra={"user_id": str(current_user.id)})
    return user_to_response(current_user)
