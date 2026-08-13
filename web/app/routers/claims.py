from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile

from app.dependencies import get_current_admin, get_current_user
from app.models.user import User
from app.schemas.claim import (
    ClaimApprove,
    ClaimCreate,
    ClaimReject,
    ClaimResponse,
    FundSummaryResponse,
)
from app.services import claim_service

router = APIRouter(tags=["claims"])


@router.post(
    "/requests/{request_id}/claims", response_model=ClaimResponse, status_code=201
)
def create_claim(
    request_id: str, data: ClaimCreate, current_user: User = Depends(get_current_user)
):
    """Owner files a damage/loss claim against a finished paid rental,
    capped at the item's declared_value."""
    return claim_service.create_claim(request_id, data, current_user)


@router.post("/claims/{claim_id}/photos", response_model=ClaimResponse, status_code=201)
async def upload_claim_photo(
    claim_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Attaches evidence while the claim is still pending review."""
    return await claim_service.upload_claim_photo(claim_id, file, current_user)


@router.get("/claims/fund-summary", response_model=FundSummaryResponse)
def fund_summary(admin: User = Depends(get_current_admin)):
    """Admin — the guarantee pool's collected/paid-out/balance totals,
    informational only (approvals aren't capped by it)."""
    return claim_service.get_fund_summary()


@router.get("/claims", response_model=list[ClaimResponse])
def list_claims(status: str | None = None, admin: User = Depends(get_current_admin)):
    """Admin — every claim, optionally filtered by status."""
    return claim_service.list_claims(status)


@router.get("/claims/{claim_id}", response_model=ClaimResponse)
def get_claim(claim_id: str, current_user: User = Depends(get_current_user)):
    """The claim's owner or an admin."""
    return claim_service.get_claim(claim_id, current_user)


@router.patch("/claims/{claim_id}/approve", response_model=ClaimResponse)
def approve_claim(
    claim_id: str,
    data: ClaimApprove,
    background_tasks: BackgroundTasks,
    admin: User = Depends(get_current_admin),
):
    """Admin — records the payout decision. Doesn't move any money; see
    mark-paid for the manual-transfer confirmation step."""
    return claim_service.approve_claim(
        claim_id, data.approved_amount, admin, background_tasks
    )


@router.patch("/claims/{claim_id}/reject", response_model=ClaimResponse)
def reject_claim(
    claim_id: str,
    data: ClaimReject,
    background_tasks: BackgroundTasks,
    admin: User = Depends(get_current_admin),
):
    """Admin — closes a claim with no payout."""
    return claim_service.reject_claim(claim_id, data.reason, admin, background_tasks)


@router.patch("/claims/{claim_id}/mark-paid", response_model=ClaimResponse)
def mark_claim_paid(
    claim_id: str,
    background_tasks: BackgroundTasks,
    admin: User = Depends(get_current_admin),
):
    """Admin — confirms the approved amount was actually transferred to the
    owner outside the platform (no automated payout exists for this)."""
    return claim_service.mark_claim_paid(claim_id, admin, background_tasks)
