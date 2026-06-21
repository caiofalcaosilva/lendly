from datetime import datetime
from typing import List

from fastapi import HTTPException, status

from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.loan_request import LoanRequestCreate, LoanRequestResponse


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
        pickup_date=req.pickup_date,
        expected_return_date=req.expected_return_date,
        actual_return_date=req.actual_return_date,
        notes=req.notes,
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


def _assert_status(req: LoanRequest, expected: str) -> None:
    if req.status != expected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Expected status '{expected}', got '{req.status}'",
        )


def create_request(data: LoanRequestCreate, current_user: User) -> LoanRequestResponse:
    item = Item.objects(id=data.item_id, is_active=True, is_available=True).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found or unavailable"
        )

    if str(item.owner.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot request your own item"
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
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    is_participant = str(req.requester.id) == str(current_user.id) or str(
        req.owner.id
    ) == str(current_user.id)
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return _to_response(req)


def accept_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = _get_as_owner(request_id, current_user)
    _assert_status(req, "pending")
    req.update(status="accepted", updated_at=datetime.utcnow())
    req.reload()
    return _to_response(req)


def refuse_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = _get_as_owner(request_id, current_user)
    _assert_status(req, "pending")
    req.update(status="refused", updated_at=datetime.utcnow())
    req.reload()
    return _to_response(req)


def start_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = _get_as_owner(request_id, current_user)
    _assert_status(req, "accepted")
    req.update(status="in_progress", updated_at=datetime.utcnow())
    req.reload()
    return _to_response(req)


def finish_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = _get_as_owner(request_id, current_user)
    _assert_status(req, "in_progress")
    req.update(
        status="finished",
        actual_return_date=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    req.reload()
    return _to_response(req)


def cancel_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    is_requester = str(req.requester.id) == str(current_user.id)
    is_owner = str(req.owner.id) == str(current_user.id)
    if not is_requester and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if req.status not in ("pending", "accepted"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a request with status '{req.status}'",
        )

    req.update(status="cancelled", updated_at=datetime.utcnow())
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
