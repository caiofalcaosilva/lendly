"""Requester asks for more days while the loan is in_progress; owner approves
(bumps expected_return_date for real) or rejects. One pending slot at a
time — the requester can ask again after a rejection."""

from datetime import UTC

from fastapi import BackgroundTasks

from app.models.user import User
from app.schemas.loan_request import LoanRequestExtend, LoanRequestResponse
from app.services import notification_service, payment_service
from app.services.loan_request_service._common import (
    assert_status,
    get_as_owner,
    get_as_requester,
    record_activity,
    reserved_quantity,
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
    record_activity(req, "rental.extension_requested", actor=current_user)
    return to_response(req, viewer=current_user)


def approve_extension(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    if req.extension_status != "pending":
        raise errors.conflict("No pending extension request")

    # Captured before the update below overwrites expected_return_date.
    additional_days = (req.requested_extension_date - req.expected_return_date).days

    # Stretching the return date can now collide with another future request
    # already accepted for this item — check only the *new* window (the
    # days being added), excluding this request itself, since the days
    # before today's expected_return_date were already accounted for.
    item = req.item
    extra_reserved = reserved_quantity(
        item,
        req.expected_return_date,
        req.requested_extension_date,
        exclude_request_id=str(req.id),
    )
    if extra_reserved + (req.quantity or 1) > (item.quantity_total or 1):
        raise errors.conflict(
            "Não é possível prorrogar — outro pedido já reservado nesse período"
        )

    req.update(
        expected_return_date=req.requested_extension_date,
        requested_extension_date=None,
        extension_status="none",
        updated_at=utcnow(),
    )
    req.reload()
    record_activity(req, "rental.extension_approved", actor=current_user)

    if req.item.availability_type == "paid":
        payment_service.create_payment_for_extension(req, additional_days)

    background_tasks.add_task(
        notification_service.create_notification,
        req.requester,
        "request_status",
        "Prorrogação aprovada",
        req.item.title,
        f"/requests/{req.id}",
    )
    return to_response(req, viewer=current_user)


def reject_extension(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    if req.extension_status != "pending":
        raise errors.conflict("No pending extension request")

    req.update(extension_status="rejected", updated_at=utcnow())
    req.reload()
    record_activity(req, "rental.extension_rejected", actor=current_user)
    background_tasks.add_task(
        notification_service.create_notification,
        req.requester,
        "request_status",
        "Prorrogação recusada",
        req.item.title,
        f"/requests/{req.id}",
    )
    return to_response(req, viewer=current_user)
