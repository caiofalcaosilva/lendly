from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse

from app.dependencies import get_current_admin, get_current_user
from app.models.user import User
from app.schemas.verification import (
    VerificationRejectRequest,
    VerificationResponse,
    VerificationStatusResponse,
)
from app.services import verification_service

router = APIRouter(prefix="/verification", tags=["verification"])


@router.post("/submit", response_model=VerificationResponse, status_code=201)
async def submit_verification(
    cpf: str = Form(...),
    selfie: UploadFile = File(...),
    document: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    return await verification_service.submit_verification(cpf, selfie, document, current_user)


@router.get("/me", response_model=VerificationStatusResponse)
def get_my_verification(current_user: User = Depends(get_current_user)):
    sub = verification_service.get_my_status(current_user)
    return VerificationStatusResponse(
        identity_status=current_user.identity_status or "none",
        rejection_reason=sub.rejection_reason if sub and sub.status == "rejected" else None,
    )


@router.get("/", response_model=List[VerificationResponse])
def list_verifications(status: Optional[str] = None, admin: User = Depends(get_current_admin)):
    return verification_service.list_submissions(status)


@router.get("/{submission_id}/photo/{kind}")
def get_verification_photo(submission_id: str, kind: str, admin: User = Depends(get_current_admin)):
    path = verification_service.get_photo_path(submission_id, kind)
    return FileResponse(path, media_type="image/jpeg")


@router.patch("/{submission_id}/approve", response_model=VerificationResponse)
def approve_verification(
    submission_id: str, background_tasks: BackgroundTasks, admin: User = Depends(get_current_admin)
):
    return verification_service.approve_submission(submission_id, admin, background_tasks)


@router.patch("/{submission_id}/reject", response_model=VerificationResponse)
def reject_verification(
    submission_id: str,
    data: VerificationRejectRequest,
    background_tasks: BackgroundTasks,
    admin: User = Depends(get_current_admin),
):
    return verification_service.reject_submission(submission_id, data.reason, admin, background_tasks)
