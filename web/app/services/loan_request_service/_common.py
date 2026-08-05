from fastapi import HTTPException, status

from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.loan_request import LoanRequestResponse

WEEKDAY_LABELS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def to_response(req: LoanRequest) -> LoanRequestResponse:
    return LoanRequestResponse(
        id=str(req.id),
        item_id=str(req.item.id),
        item_title=req.item.title,
        requester_id=str(req.requester.id),
        requester_name=req.requester.name,
        owner_id=str(req.owner.id),
        owner_name=req.owner.name,
        status=req.status,
        payment_status=req.payment_status or "unpaid",
        pickup_date=req.pickup_date,
        expected_return_date=req.expected_return_date,
        actual_return_date=req.actual_return_date,
        notes=req.notes,
        requested_extension_date=req.requested_extension_date,
        extension_status=req.extension_status or "none",
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


def get_as_owner(request_id: str, current_user: User) -> LoanRequest:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )
    if str(req.owner.id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can perform this action",
        )
    return req


def get_as_requester(request_id: str, current_user: User) -> LoanRequest:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )
    if str(req.requester.id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester can perform this action",
        )
    return req


def get_as_participant(request_id: str, current_user: User) -> LoanRequest:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )
    is_participant = str(req.requester.id) == str(current_user.id) or str(
        req.owner.id
    ) == str(current_user.id)
    if not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )
    return req


def assert_status(req: LoanRequest, expected: str) -> None:
    if req.status != expected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Expected status '{expected}', got '{req.status}'",
        )
