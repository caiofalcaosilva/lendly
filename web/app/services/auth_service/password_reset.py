import logging
import secrets
from datetime import timedelta

from fastapi import BackgroundTasks

from app.models.user import User
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest
from app.services import activity_service, email_service
from app.utils import errors
from app.utils.security import hash_password
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

_RESET_TOKEN_EXPIRE_HOURS = 1


def request_password_reset(
    data: ForgotPasswordRequest, background_tasks: BackgroundTasks
) -> dict:
    """Always returns the same response whether or not the email exists —
    otherwise this endpoint becomes a way to check which emails are
    registered."""
    user = User.objects(email=data.email, is_active=True).first()
    if user:
        token = secrets.token_urlsafe(32)
        user.update(
            password_reset_token=token,
            password_reset_expires=utcnow()
            + timedelta(hours=_RESET_TOKEN_EXPIRE_HOURS),
        )
        background_tasks.add_task(
            email_service.send_password_reset_email, user.email, user.name, token
        )
    return {"detail": "Se o e-mail existir, um link de redefinição foi enviado"}


def reset_password(data: ResetPasswordRequest) -> dict:
    user = User.objects(
        password_reset_token=data.token, password_reset_expires__gt=utcnow()
    ).first()
    if not user:
        raise errors.bad_request("Link inválido ou expirado")

    user.update(
        password_hash=hash_password(data.new_password),
        unset__password_reset_token=1,
        unset__password_reset_expires=1,
        refresh_sessions=[],
        updated_at=utcnow(),
    )
    activity_service.record(
        recipient=user,
        event="account.password_reset",
        resource_type="user",
        resource_id=str(user.id),
    )
    logger.info(
        "password reset via forgot-password flow", extra={"user_id": str(user.id)}
    )
    return {"detail": "Senha redefinida com sucesso"}
