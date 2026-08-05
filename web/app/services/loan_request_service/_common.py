from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.loan_request import LoanRequestResponse
from app.utils import errors

WEEKDAY_LABELS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]

# Phones are visible to each other only once there's an actual commitment to
# coordinate pickup around — not while the request is still just pending.
_PHONE_VISIBLE_STATUSES = {"accepted", "in_progress", "finished"}


def to_response(req: LoanRequest) -> LoanRequestResponse:
    show_phones = req.status in _PHONE_VISIBLE_STATUSES
    return LoanRequestResponse(
        id=str(req.id),
        item_id=str(req.item.id),
        item_title=req.item.title,
        requester_id=str(req.requester.id),
        requester_name=req.requester.name,
        requester_phone=req.requester.phone if show_phones else None,
        owner_id=str(req.owner.id),
        owner_name=req.owner.name,
        owner_phone=req.owner.phone if show_phones else None,
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
        raise errors.not_found("Request not found")
    if str(req.owner.id) != str(current_user.id):
        raise errors.forbidden("Only the owner can perform this action")
    return req


def get_as_requester(request_id: str, current_user: User) -> LoanRequest:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise errors.not_found("Request not found")
    if str(req.requester.id) != str(current_user.id):
        raise errors.forbidden("Only the requester can perform this action")
    return req


def get_as_participant(request_id: str, current_user: User) -> LoanRequest:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise errors.not_found("Request not found")
    is_participant = str(req.requester.id) == str(current_user.id) or str(
        req.owner.id
    ) == str(current_user.id)
    if not is_participant:
        raise errors.forbidden("Access denied")
    return req


def assert_status(req: LoanRequest, expected: str) -> None:
    if req.status != expected:
        raise errors.conflict(f"Expected status '{expected}', got '{req.status}'")
