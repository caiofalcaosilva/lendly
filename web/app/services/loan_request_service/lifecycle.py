from fastapi import BackgroundTasks, HTTPException, status

from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.loan_request import LoanRequestCreate, LoanRequestResponse
from app.services import email_service, payment_service
from app.services.loan_request_service._common import (
    WEEKDAY_LABELS,
    assert_status,
    get_as_owner,
    get_as_participant,
    to_response,
)
from app.services.loan_request_service.reliability import recalculate_reliability
from app.utils.time import utcnow


def _notify_status_change(req: LoanRequest, background_tasks: BackgroundTasks) -> None:
    background_tasks.add_task(
        email_service.send_request_status_email,
        req.requester.email,
        req.requester.name,
        req.item.title,
        req.status,
        str(req.id),
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or unavailable",
        )

    if str(item.owner.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot request your own item",
        )

    if (
        item.requires_identity_verification
        and current_user.identity_status != "approved"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Este item exige verificação de identidade aprovada. "
                "Complete sua verificação em /profile."
            ),
        )

    if item.available_days:
        allowed = set(item.available_days)
        if (
            data.pickup_date.weekday() not in allowed
            or data.expected_return_date.weekday() not in allowed
        ):
            days = ", ".join(WEEKDAY_LABELS[d] for d in item.available_days)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Este item só está disponível para retirada/devolução em: {days}"
                ),
            )

    # Block if another accepted/in_progress request already exists for this item
    conflict = LoanRequest.objects(
        item=item, status__in=["accepted", "in_progress"]
    ).first()
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
    return to_response(req)


def get_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = get_as_participant(request_id, current_user)
    return to_response(req)


def accept_request(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    assert_status(req, "pending")
    req.update(status="accepted", updated_at=utcnow())
    req.reload()

    if req.item.availability_type == "paid":
        payment_service.create_payment_for_request(req)
        req.reload()

    _notify_status_change(req, background_tasks)
    return to_response(req)


def refuse_request(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    assert_status(req, "pending")
    req.update(status="refused", updated_at=utcnow())
    req.reload()
    recalculate_reliability(current_user)
    _notify_status_change(req, background_tasks)
    return to_response(req)


def start_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    assert_status(req, "accepted")

    if req.item.availability_type == "paid" and req.payment_status != "held":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Aguardando confirmação do pagamento — a retirada só pode ser "
                "confirmada depois que o Pix for aprovado"
            ),
        )

    req.update(status="in_progress", updated_at=utcnow())
    req.reload()

    if req.item.availability_type == "paid":
        payment_service.release_payment(req)
        req.reload()

    return to_response(req)


def finish_request(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    assert_status(req, "in_progress")
    req.update(
        status="finished",
        actual_return_date=utcnow(),
        updated_at=utcnow(),
    )
    req.reload()
    recalculate_reliability(req.requester)
    _notify_status_change(req, background_tasks)
    return to_response(req)


def cancel_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = get_as_participant(request_id, current_user)

    if req.status not in ("pending", "accepted"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a request with status '{req.status}'",
        )

    # Only reachable before pickup, so a held payment always gets a full refund.
    if req.payment_status == "held":
        payment_service.refund_payment(req)
        req.reload()

    req.update(status="cancelled", cancelled_by=current_user, updated_at=utcnow())
    req.reload()
    recalculate_reliability(current_user)
    return to_response(req)
