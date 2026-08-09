"""Requester asks for more days while the loan is in_progress; owner approves
(bumps expected_return_date for real) or rejects. One pending slot at a
time — the requester can ask again after a rejection."""

from datetime import UTC

from fastapi import BackgroundTasks

from app.models.user import User
from app.schemas.loan_request import LoanRequestExtend, LoanRequestResponse
from app.services import notification_service
from app.services.loan_request_service._common import (
    assert_status,
    get_as_owner,
    get_as_requester,
    to_response,
)
from app.utils import errors
from app.utils.time import utcnow


def request_extension(
    request_id: str, data: LoanRequestExtend, current_user: User
) -> LoanRequestResponse:
    req = get_as_requester(request_id, current_user)
    assert_status(req, "in_progress")

    if req.extension_status == "pending":
        raise errors.conflict("An extension request is already pending")

    # Normalize to naive UTC to match expected_return_date before comparing.
    new_date = data.new_expected_return_date
    if new_date.tzinfo is not None:
        new_date = new_date.astimezone(UTC).replace(tzinfo=None)

    if new_date <= req.expected_return_date:
        raise errors.bad_request(
            "new_expected_return_date must be after the current expected return date"
        )

    req.update(
        requested_extension_date=new_date,
        extension_status="pending",
        updated_at=utcnow(),
    )
    req.reload()
    return to_response(req)


def approve_extension(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    if req.extension_status != "pending":
        raise errors.conflict("No pending extension request")

    req.update(
        expected_return_date=req.requested_extension_date,
        requested_extension_date=None,
        extension_status="none",
        updated_at=utcnow(),
    )
    req.reload()
    background_tasks.add_task(
        notification_service.create_notification,
        req.requester,
        "request_status",
        "Prorrogação aprovada",
        req.item.title,
        f"/requests/{req.id}",
    )
    return to_response(req)


def reject_extension(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    if req.extension_status != "pending":
        raise errors.conflict("No pending extension request")

    req.update(extension_status="rejected", updated_at=utcnow())
    req.reload()
    background_tasks.add_task(
        notification_service.create_notification,
        req.requester,
        "request_status",
        "Prorrogação recusada",
        req.item.title,
        f"/requests/{req.id}",
    )
    return to_response(req)
