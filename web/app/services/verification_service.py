import io
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import BackgroundTasks, HTTPException, UploadFile, status
from PIL import Image

from app.models.user import User
from app.models.verification import VerificationSubmission
from app.schemas.verification import VerificationResponse
from app.services import email_service
from app.utils.validators import is_valid_cpf

ALLOWED_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_DIMENSION = 1600
# Deliberately outside app/main.py's public "uploads/" StaticFiles mount —
# these are CPF documents + selfies, served only via an admin-authenticated
# endpoint, never as a plain static URL.
UPLOAD_ROOT = "verification_uploads"


def _to_response(sub: VerificationSubmission) -> VerificationResponse:
    return VerificationResponse(
        id=str(sub.id),
        user_id=str(sub.user.id),
        user_name=sub.user.name,
        cpf=sub.cpf,
        status=sub.status,
        rejection_reason=sub.rejection_reason,
        reviewed_by_name=sub.reviewed_by.name if sub.reviewed_by else None,
        reviewed_at=sub.reviewed_at,
        created_at=sub.created_at,
    )


async def _save_photo(file: UploadFile, user_id: str, kind: str) -> str:
    if file.content_type not in ALLOWED_PHOTO_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado")

    raw = await file.read()
    try:
        Image.open(io.BytesIO(raw)).verify()
        # Re-open after verify() and convert to RGB — also strips EXIF
        # (including GPS), same reasoning as item photo uploads.
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Arquivo de imagem inválido")

    img.thumbnail((MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION))

    user_dir = os.path.join(UPLOAD_ROOT, user_id)
    os.makedirs(user_dir, exist_ok=True)
    filename = f"{kind}_{uuid.uuid4().hex}.jpg"
    path = os.path.join(user_dir, filename)
    img.save(path, "JPEG", quality=85)
    return path


async def submit_verification(
    cpf: str, selfie: UploadFile, document: UploadFile, current_user: User
) -> VerificationResponse:
    if not is_valid_cpf(cpf):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CPF inválido")

    if current_user.identity_status in ("pending", "approved"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você já tem uma verificação pendente ou aprovada",
        )

    existing_owner = User.objects(cpf=cpf, id__ne=current_user.id).first()
    if existing_owner:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este CPF já está em uso")

    selfie_path = await _save_photo(selfie, str(current_user.id), "selfie")
    document_path = await _save_photo(document, str(current_user.id), "document")

    sub = VerificationSubmission(
        user=current_user, cpf=cpf, selfie_path=selfie_path, document_path=document_path
    )
    sub.save()

    current_user.update(cpf=cpf, identity_status="pending")
    return _to_response(sub)


def get_my_status(current_user: User) -> Optional[VerificationSubmission]:
    return VerificationSubmission.objects(user=current_user).order_by("-created_at").first()


def list_submissions(status_filter: Optional[str]) -> List[VerificationResponse]:
    qs = VerificationSubmission.objects()
    if status_filter:
        qs = qs.filter(status=status_filter)
    return [_to_response(s) for s in qs.order_by("-created_at")]


def _get_pending_submission(submission_id: str) -> VerificationSubmission:
    sub = VerificationSubmission.objects(id=submission_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    if sub.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already reviewed")
    return sub


def get_photo_path(submission_id: str, kind: str) -> str:
    if kind not in ("selfie", "document"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    sub = VerificationSubmission.objects(id=submission_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return sub.selfie_path if kind == "selfie" else sub.document_path


def approve_submission(
    submission_id: str, admin: User, background_tasks: BackgroundTasks
) -> VerificationResponse:
    sub = _get_pending_submission(submission_id)
    sub.update(status="approved", reviewed_by=admin, reviewed_at=datetime.utcnow())
    sub.reload()
    sub.user.update(identity_status="approved")
    background_tasks.add_task(
        email_service.send_verification_approved_email, sub.user.email, sub.user.name
    )
    return _to_response(sub)


def reject_submission(
    submission_id: str, reason: Optional[str], admin: User, background_tasks: BackgroundTasks
) -> VerificationResponse:
    sub = _get_pending_submission(submission_id)
    sub.update(
        status="rejected", reviewed_by=admin, reviewed_at=datetime.utcnow(),
        rejection_reason=reason,
    )
    sub.reload()
    sub.user.update(identity_status="rejected")
    background_tasks.add_task(
        email_service.send_verification_rejected_email, sub.user.email, sub.user.name, reason or ""
    )
    return _to_response(sub)
