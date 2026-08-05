"""Requester asks for more days while the loan is in_progress; owner approves
(bumps expected_return_date for real) or rejects. One pending slot at a
time — the requester can ask again after a rejection."""

from datetime import UTC

from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.loan_request import LoanRequestExtend, LoanRequestResponse
from app.services.loan_request_service._common import (
    assert_status,
    get_as_owner,
    get_as_requester,
    to_response,
)
from app.utils.time import utcnow


def request_extension(
    request_id: str, data: LoanRequestExtend, current_user: User
) -> LoanRequestResponse:
    req = get_as_requester(request_id, current_user)
    assert_status(req, "in_progress")

    if req.extension_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An extension request is already pending",
        )

    # Mongo round-trips datetimes as naive UTC (see expected_return_date,
    # loaded from the DB above); normalize the freshly-parsed pydantic value
    # the same way before comparing, or an offset-aware client payload
    # (e.g. a browser's toISOString(), which ends in "Z") blows up here.
    new_date = data.new_expected_return_date
    if new_date.tzinfo is not None:
        new_date = new_date.astimezone(UTC).replace(tzinfo=None)

    if new_date <= req.expected_return_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "new_expected_return_date must be after the current expected "
                "return date"
            ),
        )

    req.update(
        requested_extension_date=new_date,
        extension_status="pending",
        updated_at=utcnow(),
    )
    req.reload()
    return to_response(req)


def approve_extension(request_id: str, current_user: User) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    if req.extension_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="No pending extension request"
        )

    req.update(
        expected_return_date=req.requested_extension_date,
        requested_extension_date=None,
        extension_status="none",
        updated_at=utcnow(),
    )
    req.reload()
    return to_response(req)


def reject_extension(request_id: str, current_user: User) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    if req.extension_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="No pending extension request"
        )

    req.update(extension_status="rejected", updated_at=utcnow())
    req.reload()
    return to_response(req)
