import uuid

from fastapi import BackgroundTasks, UploadFile

from app.models.user import User
from app.models.verification import VerificationSubmission
from app.schemas.verification import VerificationResponse
from app.services import activity_service, email_service, notification_service, storage
from app.utils import errors
from app.utils.crypto import decrypt, digits_hash, encrypt
from app.utils.images import load_and_resize
from app.utils.notifications import should_notify
from app.utils.time import utcnow
from app.utils.validators import is_valid_cpf, normalize_digits


def _to_response(sub: VerificationSubmission) -> VerificationResponse:
    return VerificationResponse(
        id=str(sub.id),
        user_id=str(sub.user.id),
        user_name=sub.user.name,
        cpf=decrypt(sub.cpf),
        status=sub.status,
        rejection_reason=sub.rejection_reason,
        reviewed_by_name=sub.reviewed_by.name if sub.reviewed_by else None,
        reviewed_at=sub.reviewed_at,
        created_at=sub.created_at,
    )


async def _save_photo(file: UploadFile, user_id: str, kind: str) -> str:
    img = await load_and_resize(file)
    key = f"{user_id}/{kind}_{uuid.uuid4().hex}.jpg"
    return storage.save_private_image(img, key)


async def submit_verification(
    cpf: str, selfie: UploadFile, document: UploadFile, current_user: User
) -> VerificationResponse:
    cpf = normalize_digits(cpf)
    if not is_valid_cpf(cpf):
        raise errors.bad_request("CPF inválido")

    if current_user.identity_status in ("pending", "approved"):
        raise errors.bad_request(
            "Você já tem uma verificação pendente ou aprovada",
        )

    cpf_hash = digits_hash(cpf)
    existing_owner = User.objects(cpf_hash=cpf_hash, id__ne=current_user.id).first()
    if existing_owner:
        raise errors.conflict("Este CPF já está em uso")

    selfie_path = await _save_photo(selfie, str(current_user.id), "selfie")
    document_path = await _save_photo(document, str(current_user.id), "document")

    sub = VerificationSubmission(
        user=current_user,
        cpf=encrypt(cpf),
        selfie_path=selfie_path,
        document_path=document_path,
    )
    sub.save()

    current_user.update(cpf=encrypt(cpf), cpf_hash=cpf_hash, identity_status="pending")
    activity_service.record(
        recipient=current_user,
        event="verification.submitted",
        actor=current_user,
        resource_type="verification",
        resource_id=str(sub.id),
    )
    return _to_response(sub)


def get_my_status(current_user: User) -> VerificationSubmission | None:
    return (
        VerificationSubmission.objects(user=current_user)
        .order_by("-created_at")
        .first()
    )


def list_submissions(
    status_filter: str | None, skip: int = 0, limit: int = 100
) -> list[VerificationResponse]:
    qs = VerificationSubmission.objects()
    if status_filter:
        qs = qs.filter(status=status_filter)
    return [_to_response(s) for s in qs.order_by("-created_at").skip(skip).limit(limit)]


def _get_submission_in_status(
    submission_id: str, allowed_statuses: tuple[str, ...]
) -> VerificationSubmission:
    sub = VerificationSubmission.objects(id=submission_id).first()
    if not sub:
        raise errors.not_found("Submission not found")
    if sub.status not in allowed_statuses:
        raise errors.bad_request("Already reviewed")
    return sub


def get_photo_path(submission_id: str, kind: str) -> str:
    if kind not in ("selfie", "document"):
        raise errors.not_found("Not found")
    sub = VerificationSubmission.objects(id=submission_id).first()
    if not sub:
        raise errors.not_found("Submission not found")
    return sub.selfie_path if kind == "selfie" else sub.document_path


def approve_submission(
    submission_id: str, admin: User, background_tasks: BackgroundTasks
) -> VerificationResponse:
    sub = _get_submission_in_status(submission_id, ("pending",))
    sub.update(
        status="approved", reviewed_by=admin, reviewed_at=utcnow(), updated_at=utcnow()
    )
    sub.reload()
    sub.user.update(identity_status="approved")
    activity_service.record(
        recipient=sub.user,
        event="verification.approved",
        actor=admin,
        resource_type="verification",
        resource_id=str(sub.id),
    )
    if should_notify(sub.user, "verification_result"):
        background_tasks.add_task(
            email_service.send_verification_approved_email,
            sub.user.email,
            sub.user.name,
        )
    background_tasks.add_task(
        notification_service.create_notification,
        sub.user,
        "verification_result",
        "Sua identidade foi verificada!",
        "Agora você pode solicitar itens que exigem verificação.",
        "/profile#identity-verification",
    )
    return _to_response(sub)


def reject_submission(
    submission_id: str,
    reason: str | None,
    admin: User,
    background_tasks: BackgroundTasks,
) -> VerificationResponse:
    """Rejects a pending submission, or revokes one that was already
    approved if a problem turns up later (e.g. a doctored document
    noticed after the fact) — either way the user's identity_status ends
    up 'rejected' and loses access to items that require verification."""
    sub = _get_submission_in_status(submission_id, ("pending", "approved"))
    sub.update(
        status="rejected",
        reviewed_by=admin,
        reviewed_at=utcnow(),
        rejection_reason=reason,
        updated_at=utcnow(),
    )
    sub.reload()
    sub.user.update(identity_status="rejected")
    activity_service.record(
        recipient=sub.user,
        event="verification.rejected",
        actor=admin,
        resource_type="verification",
        resource_id=str(sub.id),
        metadata={"reason": reason} if reason else None,
    )
    if should_notify(sub.user, "verification_result"):
        background_tasks.add_task(
            email_service.send_verification_rejected_email,
            sub.user.email,
            sub.user.name,
            reason or "",
        )
    background_tasks.add_task(
        notification_service.create_notification,
        sub.user,
        "verification_result",
        "Não foi possível verificar sua identidade",
        reason or None,
        "/profile#identity-verification",
    )
    return _to_response(sub)
