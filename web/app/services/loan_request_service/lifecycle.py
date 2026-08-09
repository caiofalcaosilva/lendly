from datetime import timedelta

from fastapi import BackgroundTasks

from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.loan_request import LoanRequestCreate, LoanRequestResponse
from app.services import email_service, notification_service, payment_service
from app.services.loan_request_service._common import (
    WEEKDAY_LABELS,
    assert_status,
    get_as_owner,
    get_as_participant,
    to_response,
)
from app.services.loan_request_service.reliability import (
    recalculate_reliability,
    recalculate_response_time,
)
from app.services.platform_settings_service import get_settings as get_platform_settings
from app.utils import errors
from app.utils.notifications import should_notify
from app.utils.time import utcnow

_STATUS_NOTIFICATION_TITLES = {
    "accepted": "Seu pedido foi aceito!",
    "refused": "Seu pedido foi recusado",
    "finished": "Empréstimo finalizado",
}


def _notify_status_change(req: LoanRequest, background_tasks: BackgroundTasks) -> None:
    if should_notify(req.requester, "request_status"):
        background_tasks.add_task(
            email_service.send_request_status_email,
            req.requester.email,
            req.requester.name,
            req.item.title,
            req.status,
            str(req.id),
        )
    title = _STATUS_NOTIFICATION_TITLES.get(req.status)
    if title:
        background_tasks.add_task(
            notification_service.create_notification,
            req.requester,
            "request_status",
            title,
            req.item.title,
            f"/requests/{req.id}",
        )


def create_request(data: LoanRequestCreate, current_user: User) -> LoanRequestResponse:
    if current_user.is_admin:
        raise errors.bad_request(
            "Contas administrativas não podem solicitar itens",
        )

    item = Item.objects(id=data.item_id, is_active=True, is_available=True).first()
    if not item:
        raise errors.not_found("Item not found or unavailable")

    if str(item.owner.id) == str(current_user.id):
        raise errors.bad_request("Cannot request your own item")

    if (
        item.requires_identity_verification
        and current_user.identity_status != "approved"
    ):
        raise errors.forbidden(
            "Este item exige verificação de identidade aprovada. "
            "Complete sua verificação em /profile."
        )

    if item.available_days:
        allowed = set(item.available_days)
        if (
            data.pickup_date.weekday() not in allowed
            or data.expected_return_date.weekday() not in allowed
        ):
            days = ", ".join(WEEKDAY_LABELS[d] for d in item.available_days)
            raise errors.bad_request(
                f"Este item só está disponível para retirada/devolução em: {days}"
            )

    # Block if another accepted/in_progress request already exists for this item
    conflict = LoanRequest.objects(
        item=item, status__in=["accepted", "in_progress"]
    ).first()
    if conflict:
        raise errors.conflict("Item already has an active loan in progress")

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
    req.update(status="accepted", responded_at=utcnow(), updated_at=utcnow())
    req.reload()
    recalculate_response_time(current_user)

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
    req.update(status="refused", responded_at=utcnow(), updated_at=utcnow())
    req.reload()
    recalculate_reliability(current_user)
    recalculate_response_time(current_user)
    _notify_status_change(req, background_tasks)
    return to_response(req)


def _complete_pickup(req: LoanRequest) -> None:
    req.update(status="in_progress", updated_at=utcnow())
    req.reload()
    if req.item.availability_type == "paid":
        payment_service.release_payment(req)
        req.reload()


def confirm_pickup(request_id: str, current_user: User) -> LoanRequestResponse:
    """Either side confirms the item changed hands. Only once BOTH the
    owner and the requester have confirmed does the request actually move
    to 'in_progress' — an owner acting alone can no longer claim a pickup
    that never happened (see force_pickup for the deliberate escape hatch)."""
    req = get_as_participant(request_id, current_user)
    assert_status(req, "accepted")

    if req.item.availability_type == "paid" and req.payment_status != "held":
        raise errors.conflict(
            "Aguardando confirmação do pagamento — a retirada só pode ser "
            "confirmada depois que o Pix for aprovado"
        )

    is_owner = str(req.owner.id) == str(current_user.id)
    field = (
        "pickup_confirmed_by_owner_at"
        if is_owner
        else "pickup_confirmed_by_requester_at"
    )
    if getattr(req, field):
        raise errors.conflict("Você já confirmou a retirada")

    req.update(**{field: utcnow(), "updated_at": utcnow()})
    req.reload()

    if req.pickup_confirmed_by_owner_at and req.pickup_confirmed_by_requester_at:
        _complete_pickup(req)

    return to_response(req)


def force_pickup(request_id: str, current_user: User) -> LoanRequestResponse:
    """Owner-only escape hatch: moves the request to 'in_progress' without
    the requester's confirmation, once the owner has waited out the grace
    period since confirming their own side. Flagged via pickup_forced so
    it stays visible on the request going forward."""
    req = get_as_owner(request_id, current_user)
    assert_status(req, "accepted")

    if not req.pickup_confirmed_by_owner_at:
        raise errors.conflict("Confirme sua própria retirada antes de forçar")

    grace_hours = get_platform_settings().handoff_confirmation_grace_hours
    elapsed = utcnow() - req.pickup_confirmed_by_owner_at
    if elapsed < timedelta(hours=grace_hours):
        raise errors.conflict(
            f"Aguarde {grace_hours}h desde sua confirmação antes de forçar a retirada"
        )

    req.update(pickup_forced=True, updated_at=utcnow())
    req.reload()
    _complete_pickup(req)
    return to_response(req)


def _complete_return(req: LoanRequest, background_tasks: BackgroundTasks) -> None:
    req.update(
        status="finished",
        actual_return_date=utcnow(),
        updated_at=utcnow(),
    )
    req.reload()
    recalculate_reliability(req.requester)
    _notify_status_change(req, background_tasks)


def confirm_return(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    """Either side confirms the item was returned. Same both-sides-required
    rule as confirm_pickup — see force_return for the owner's escape hatch."""
    req = get_as_participant(request_id, current_user)
    assert_status(req, "in_progress")

    is_owner = str(req.owner.id) == str(current_user.id)
    field = (
        "return_confirmed_by_owner_at"
        if is_owner
        else "return_confirmed_by_requester_at"
    )
    if getattr(req, field):
        raise errors.conflict("Você já confirmou a devolução")

    req.update(**{field: utcnow(), "updated_at": utcnow()})
    req.reload()

    if req.return_confirmed_by_owner_at and req.return_confirmed_by_requester_at:
        _complete_return(req, background_tasks)

    return to_response(req)


def force_return(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    """Owner-only escape hatch for the return side — same grace-period rule
    as force_pickup. Flags return_forced."""
    req = get_as_owner(request_id, current_user)
    assert_status(req, "in_progress")

    if not req.return_confirmed_by_owner_at:
        raise errors.conflict("Confirme sua própria devolução antes de forçar")

    grace_hours = get_platform_settings().handoff_confirmation_grace_hours
    elapsed = utcnow() - req.return_confirmed_by_owner_at
    if elapsed < timedelta(hours=grace_hours):
        raise errors.conflict(
            f"Aguarde {grace_hours}h desde sua confirmação antes de forçar a devolução"
        )

    req.update(return_forced=True, updated_at=utcnow())
    req.reload()
    _complete_return(req, background_tasks)
    return to_response(req)


def cancel_request(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = get_as_participant(request_id, current_user)

    if req.status not in ("pending", "accepted"):
        raise errors.conflict(f"Cannot cancel a request with status '{req.status}'")

    # Only reachable before pickup, so a held payment always gets a full refund.
    if req.payment_status == "held":
        payment_service.refund_payment(req)
        req.reload()

    req.update(status="cancelled", cancelled_by=current_user, updated_at=utcnow())
    req.reload()
    recalculate_reliability(current_user)

    other = (
        req.owner if str(current_user.id) == str(req.requester.id) else req.requester
    )
    background_tasks.add_task(
        notification_service.create_notification,
        other,
        "request_status",
        "Solicitação cancelada",
        req.item.title,
        f"/requests/{req.id}",
    )

    return to_response(req)
