from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse, RedirectResponse

from app.dependencies import get_current_admin, get_current_user
from app.models.user import User
from app.schemas.verification import (
    VerificationRejectRequest,
    VerificationResponse,
    VerificationStatusResponse,
)
from app.services import storage, verification_service

router = APIRouter(prefix="/verification", tags=["verification"])


@router.post("/submit", response_model=VerificationResponse, status_code=201)
async def submit_verification(
    cpf: str = Form(...),
    selfie: UploadFile = File(...),
    document: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Submits CPF + selfie + document photo for identity verification —
    sets identity_status to 'pending' until an admin reviews it."""
    return await verification_service.submit_verification(
        cpf, selfie, document, current_user
    )


@router.get("/me", response_model=VerificationStatusResponse)
def get_my_verification(current_user: User = Depends(get_current_user)):
    """The logged-in user's own identity_status, plus the rejection reason
    if their latest submission was rejected."""
    sub = verification_service.get_my_status(current_user)
    return VerificationStatusResponse(
        identity_status=current_user.identity_status or "none",
        rejection_reason=sub.rejection_reason
        if sub and sub.status == "rejected"
        else None,
    )


@router.get("/", response_model=list[VerificationResponse])
def list_verifications(
    status: str | None = None, admin: User = Depends(get_current_admin)
):
    """Admin — every verification submission, optionally filtered by
    status."""
    return verification_service.list_submissions(status)


@router.get("/{submission_id}/photo/{kind}")
def get_verification_photo(
    submission_id: str, kind: str, admin: User = Depends(get_current_admin)
):
    """Admin — the selfie or document photo for a submission (kind is
    'selfie' or 'document'). Never exposed as a public static URL — a
    redirect to a short-lived presigned URL when stored in R2, or the file
    straight off local disk otherwise."""
    reference = verification_service.get_photo_path(submission_id, kind)
    presigned_url = storage.private_image_url(reference)
    if presigned_url:
        return RedirectResponse(presigned_url)
    return FileResponse(reference, media_type="image/jpeg")


@router.patch("/{submission_id}/approve", response_model=VerificationResponse)
def approve_verification(
    submission_id: str,
    background_tasks: BackgroundTasks,
    admin: User = Depends(get_current_admin),
):
    """Admin — approves a pending submission, setting the user's
    identity_status to 'approved'."""
    return verification_service.approve_submission(
        submission_id, admin, background_tasks
    )


@router.patch("/{submission_id}/reject", response_model=VerificationResponse)
def reject_verification(
    submission_id: str,
    data: VerificationRejectRequest,
    background_tasks: BackgroundTasks,
    admin: User = Depends(get_current_admin),
):
    """Admin — rejects a pending submission with an optional reason, or
    revokes one already approved if a problem is found afterwards."""
    return verification_service.reject_submission(
        submission_id, data.reason, admin, background_tasks
    )
