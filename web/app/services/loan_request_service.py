from datetime import datetime, timezone
from typing import List

from fastapi import BackgroundTasks, HTTPException, status

from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.loan_request import LoanRequestCreate, LoanRequestExtend, LoanRequestResponse
from app.services import email_service, payment_service

WEEKDAY_LABELS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def _to_response(req: LoanRequest) -> LoanRequestResponse:
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


def _get_as_owner(request_id: str, current_user: User) -> LoanRequest:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if str(req.owner.id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can perform this action",
        )
    return req


def _get_as_requester(request_id: str, current_user: User) -> LoanRequest:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if str(req.requester.id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester can perform this action",
        )
    return req


def _get_as_participant(request_id: str, current_user: User) -> LoanRequest:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    is_participant = str(req.requester.id) == str(current_user.id) or str(
        req.owner.id
    ) == str(current_user.id)
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return req


def _assert_status(req: LoanRequest, expected: str) -> None:
    if req.status != expected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Expected status '{expected}', got '{req.status}'",
        )


def create_request(data: LoanRequestCreate, current_user: User) -> LoanRequestResponse:
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contas administrativas não podem solicitar itens",
        )

    item = Item.objects(id=data.item_id, is_active=True, is_available=True).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found or unavailable"
        )

    if str(item.owner.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot request your own item"
        )

    if item.requires_identity_verification and current_user.identity_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este item exige verificação de identidade aprovada. Complete sua verificação em /profile.",
        )

    if item.available_days:
        allowed = set(item.available_days)
        if data.pickup_date.weekday() not in allowed or data.expected_return_date.weekday() not in allowed:
            days = ", ".join(WEEKDAY_LABELS[d] for d in item.available_days)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Este item só está disponível para retirada/devolução em: {days}",
            )

    # Block if another accepted/in_progress request already exists for this item
    conflict = LoanRequest.objects(item=item, status__in=["accepted", "in_progress"]).first()
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Item already has an active loan in progress",
        )

    req = LoanRequest(
        item=item,
        requester=current_user,
        owner=item.owner,
        pickup_date=data.pickup_date,
        expected_return_date=data.expected_return_date,
        notes=data.notes,
    )
    req.save()
    return _to_response(req)


def get_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = _get_as_participant(request_id, current_user)
    return _to_response(req)


# ── Reliability score ────────────────────────────────────────────────────────
# Behavioral score (0-100) distinct from average_rating: how often this user
# follows through — on-time returns, vs. late returns / refusals / cancellations.
# Full recompute on every relevant transition, same pattern as
# review_service._recalculate_rating.

_ON_TIME_POINTS = 1.0
_LATE_POINTS = 0.5
_REFUSED_POINTS = 0.7  # softer than a cancellation — declining a still-pending
# request breaks no promise, unlike backing out after already committing.
_CANCELLED_POINTS = 0.0


def _recalculate_reliability(user: User) -> None:
    points = 0.0
    count = 0
    finished_count = 0
    on_time_count = 0

    for req in LoanRequest.objects(requester=user, status="finished"):
        count += 1
        finished_count += 1
        on_time = req.actual_return_date and req.actual_return_date <= req.expected_return_date
        if on_time:
            on_time_count += 1
        points += _ON_TIME_POINTS if on_time else _LATE_POINTS

    refused_count = LoanRequest.objects(owner=user, status="refused").count()
    count += refused_count
    points += refused_count * _REFUSED_POINTS

    cancelled_count = LoanRequest.objects(cancelled_by=user, status="cancelled").count()
    count += cancelled_count
    points += cancelled_count * _CANCELLED_POINTS

    updates = {}
    if finished_count > 0:
        updates["on_time_rate"] = round(100 * on_time_count / finished_count, 1)
        updates["finished_loans_count"] = finished_count
    if count > 0:
        updates["reliability_score"] = round(100 * points / count, 1)
        updates["reliability_count"] = count
    if updates:
        user.update(**updates)


def _notify_status_change(req: LoanRequest, background_tasks: BackgroundTasks) -> None:
    background_tasks.add_task(
        email_service.send_request_status_email,
        req.requester.email,
        req.requester.name,
        req.item.title,
        req.status,
        str(req.id),
    )


def accept_request(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = _get_as_owner(request_id, current_user)
    _assert_status(req, "pending")
    req.update(status="accepted", updated_at=datetime.utcnow())
    req.reload()

    if req.item.availability_type == "paid":
        payment_service.create_payment_for_request(req)
        req.reload()

    _notify_status_change(req, background_tasks)
    return _to_response(req)


def refuse_request(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = _get_as_owner(request_id, current_user)
    _assert_status(req, "pending")
    req.update(status="refused", updated_at=datetime.utcnow())
    req.reload()
    _recalculate_reliability(current_user)
    _notify_status_change(req, background_tasks)
    return _to_response(req)


def start_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = _get_as_owner(request_id, current_user)
    _assert_status(req, "accepted")

    if req.item.availability_type == "paid" and req.payment_status != "held":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Aguardando confirmação do pagamento — a retirada só pode ser confirmada depois que o Pix for aprovado",
        )

    req.update(status="in_progress", updated_at=datetime.utcnow())
    req.reload()

    if req.item.availability_type == "paid":
        payment_service.release_payment(req)
        req.reload()

    return _to_response(req)


def finish_request(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = _get_as_owner(request_id, current_user)
    _assert_status(req, "in_progress")
    req.update(
        status="finished",
        actual_return_date=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    req.reload()
    _recalculate_reliability(req.requester)
    _notify_status_change(req, background_tasks)
    return _to_response(req)


def cancel_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = _get_as_participant(request_id, current_user)

    if req.status not in ("pending", "accepted"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a request with status '{req.status}'",
        )

    # cancel_request only ever runs before pickup (in_progress is excluded
    # above) — so a held payment always gets a full refund here. Once
    # picked up, there's no cancellation path at all, only finish_request.
    if req.payment_status == "held":
        payment_service.refund_payment(req)
        req.reload()

    req.update(status="cancelled", cancelled_by=current_user, updated_at=datetime.utcnow())
    req.reload()
    _recalculate_reliability(current_user)
    return _to_response(req)


# ── Extension requests ──────────────────────────────────────────────────────
# Requester asks for more days while the loan is in_progress; owner approves
# (bumps expected_return_date for real) or rejects. One pending slot at a
# time — the requester can ask again after a rejection.

def request_extension(
    request_id: str, data: LoanRequestExtend, current_user: User
) -> LoanRequestResponse:
    req = _get_as_requester(request_id, current_user)
    _assert_status(req, "in_progress")

    if req.extension_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="An extension request is already pending"
        )

    # Mongo round-trips datetimes as naive UTC (see expected_return_date,
    # loaded from the DB above); normalize the freshly-parsed pydantic value
    # the same way before comparing, or an offset-aware client payload
    # (e.g. a browser's toISOString(), which ends in "Z") blows up here.
    new_date = data.new_expected_return_date
    if new_date.tzinfo is not None:
        new_date = new_date.astimezone(timezone.utc).replace(tzinfo=None)

    if new_date <= req.expected_return_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_expected_return_date must be after the current expected return date",
        )

    req.update(
        requested_extension_date=new_date,
        extension_status="pending",
        updated_at=datetime.utcnow(),
    )
    req.reload()
    return _to_response(req)


def approve_extension(request_id: str, current_user: User) -> LoanRequestResponse:
    req = _get_as_owner(request_id, current_user)
    if req.extension_status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No pending extension request")

    req.update(
        expected_return_date=req.requested_extension_date,
        requested_extension_date=None,
        extension_status="none",
        updated_at=datetime.utcnow(),
    )
    req.reload()
    return _to_response(req)


def reject_extension(request_id: str, current_user: User) -> LoanRequestResponse:
    req = _get_as_owner(request_id, current_user)
    if req.extension_status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No pending extension request")

    req.update(extension_status="rejected", updated_at=datetime.utcnow())
    req.reload()
    return _to_response(req)


def get_sent_requests(current_user: User) -> List[LoanRequestResponse]:
    return [
        _to_response(r)
        for r in LoanRequest.objects(requester=current_user).order_by("-created_at")
    ]


def get_received_requests(current_user: User) -> List[LoanRequestResponse]:
    return [
        _to_response(r)
        for r in LoanRequest.objects(owner=current_user).order_by("-created_at")
    ]


def get_history(current_user: User) -> List[LoanRequestResponse]:
    reqs = LoanRequest.objects(
        status__in=["finished", "cancelled", "refused"],
        __raw__={"$or": [{"requester": current_user.id}, {"owner": current_user.id}]},
    ).order_by("-updated_at")
    return [_to_response(r) for r in reqs]
