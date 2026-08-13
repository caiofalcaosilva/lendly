from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.loan_request import LoanRequestResponse
from app.services import activity_service
from app.utils import errors

WEEKDAY_LABELS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]

# Phones are visible to each other only once there's an actual commitment to
# coordinate pickup around — not while the request is still just pending.
_PHONE_VISIBLE_STATUSES = {"accepted", "in_progress", "finished"}

# Wrong-code attempts allowed before the owner has to ask for a fresh code —
# a short numeric code is brute-forceable otherwise.
DELIVERY_CODE_MAX_ATTEMPTS = 5


def to_response(req: LoanRequest, viewer: User | None = None) -> LoanRequestResponse:
    show_phones = req.status in _PHONE_VISIBLE_STATUSES
    # The code is only ever shown to the requester — the owner is told it
    # verbally/in person and types it in blind. Defaulting viewer to None
    # hides the code (fails closed) if a caller forgets to pass one.
    is_requester_viewer = viewer is not None and str(viewer.id) == str(req.requester.id)
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
        fulfillment_method=req.fulfillment_method or "pickup",
        delivery_confirmation_code=(
            req.delivery_confirmation_code if is_requester_viewer else None
        ),
        delivery_confirmation_code_attempts=req.delivery_confirmation_code_attempts
        or 0,
        delivery_confirmation_code_max_attempts=DELIVERY_CODE_MAX_ATTEMPTS,
        pickup_confirmed_by_owner_at=req.pickup_confirmed_by_owner_at,
        pickup_confirmed_by_requester_at=req.pickup_confirmed_by_requester_at,
        pickup_forced=req.pickup_forced or False,
        return_confirmed_by_owner_at=req.return_confirmed_by_owner_at,
        return_confirmed_by_requester_at=req.return_confirmed_by_requester_at,
        return_forced=req.return_forced or False,
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


def record_activity(req: LoanRequest, event: str, actor: User | None = None) -> None:
    """One Activity per participant (owner + requester) — shared by both
    lifecycle.py and extensions.py, so every LoanRequest event (status or
    extension) records the same way. Unlike _notify_status_change, which
    only alerts whoever didn't just act, the timeline records the fact for
    both sides, including the actor's own action."""
    for recipient in (req.owner, req.requester):
        activity_service.record(
            recipient=recipient,
            event=event,
            actor=actor,
            resource_type="loan_request",
            resource_id=str(req.id),
            resource_title=req.item.title,
        )
