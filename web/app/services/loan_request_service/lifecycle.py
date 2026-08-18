import secrets
from datetime import timedelta

from fastapi import BackgroundTasks

from app.models.item import Item
from app.models.loan_request import DeliveryCode, LoanRequest
from app.models.user import User
from app.schemas.loan_request import LoanRequestCreate, LoanRequestResponse
from app.services import email_service, notification_service, payment_service
from app.services.loan_request_service._common import (
    DELIVERY_CODE_MAX_ATTEMPTS,
    WEEKDAY_LABELS,
    assert_status,
    get_as_owner,
    get_as_participant,
    record_activity,
    reserved_quantity,
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


def _generate_delivery_code() -> str:
    """A 6-digit numeric code — short enough to read aloud/type at the door.
    Not required to be globally unique: it's only ever validated against
    the one LoanRequest it belongs to."""
    return f"{secrets.randbelow(1_000_000):06d}"


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
    if not title:
        return
    # accepted/refused only ever happen because the owner just acted on it —
    # they already know. finished is mutual (either side can supply the
    # closing confirmation), so both sides need to hear about it, not just
    # whoever didn't happen to trigger it.
    recipients = (
        [req.owner, req.requester] if req.status == "finished" else [req.requester]
    )
    for recipient in recipients:
        background_tasks.add_task(
            notification_service.create_notification,
            recipient,
            "request_status",
            title,
            req.item.title,
            f"/requests/{req.id}",
        )


def create_request(
    data: LoanRequestCreate,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> LoanRequestResponse:
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

    quantity = data.quantity or 1
    quantity_total = item.quantity_total or 1
    if quantity > quantity_total:
        raise errors.bad_request("Esse item não tem tantas unidades assim")

    # Block only if the requested date range would push the total reserved
    # (across every accepted/in_progress request that overlaps it) past
    # quantity_total — a date-range-aware replacement for the old bare
    # "does any active request exist at all" check, which blocked even
    # completely non-overlapping future dates on a single-unit item.
    already_reserved = reserved_quantity(
        item, data.pickup_date, data.expected_return_date
    )
    if already_reserved + quantity > quantity_total:
        raise errors.conflict("Não há unidades suficientes disponíveis nessas datas")

    options = item.fulfillment_options or ["pickup"]
    if len(options) == 1:
        # Only one option — nothing to ask the requester, just use it.
        fulfillment_method = options[0]
    elif data.fulfillment_method and data.fulfillment_method.value in options:
        fulfillment_method = data.fulfillment_method.value
    elif data.fulfillment_method:
        raise errors.bad_request("Este item não aceita esse método de retirada/entrega")
    else:
        raise errors.bad_request("Escolha o método de retirada/entrega para este item")

    req = LoanRequest(
        item=item,
        requester=current_user,
        owner=item.owner,
        pickup_date=data.pickup_date,
        expected_return_date=data.expected_return_date,
        quantity=quantity,
        notes=data.notes,
        fulfillment_method=fulfillment_method,
    )
    req.save()
    record_activity(req, "rental.requested", actor=current_user)

    if background_tasks:
        if should_notify(item.owner, "request_status"):
            background_tasks.add_task(
                email_service.send_new_request_email,
                item.owner.email,
                item.owner.name,
                current_user.name,
                item.title,
                str(req.id),
            )
        background_tasks.add_task(
            notification_service.create_notification,
            item.owner,
            "request_status",
            "Nova solicitação recebida",
            f"{current_user.name} quer {item.title}",
            f"/requests/{req.id}",
        )

    return to_response(req, viewer=current_user)


def get_request(request_id: str, current_user: User) -> LoanRequestResponse:
    req = get_as_participant(request_id, current_user)
    return to_response(req, viewer=current_user)


def accept_request(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    assert_status(req, "pending")
    updates = {"status": "accepted", "responded_at": utcnow(), "updated_at": utcnow()}
    if req.fulfillment_method == "delivery":
        updates["delivery_confirmation"] = DeliveryCode(
            code=_generate_delivery_code(), attempts=0, generated_at=utcnow()
        )
    req.update(**updates)
    req.reload()
    recalculate_response_time(current_user)

    if req.item.availability_type == "paid":
        payment_service.create_payment_for_request(req)
        req.reload()

    record_activity(req, "rental.accepted", actor=current_user)
    _notify_status_change(req, background_tasks)
    return to_response(req, viewer=current_user)


def refuse_request(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    req = get_as_owner(request_id, current_user)
    assert_status(req, "pending")
    req.update(status="refused", responded_at=utcnow(), updated_at=utcnow())
    req.reload()
    recalculate_reliability(current_user)
    recalculate_response_time(current_user)
    record_activity(req, "rental.refused", actor=current_user)
    _notify_status_change(req, background_tasks)
    return to_response(req, viewer=current_user)


def _complete_pickup(req: LoanRequest) -> None:
    req.update(status="in_progress", updated_at=utcnow())
    req.reload()
    if req.item.availability_type == "paid":
        payment_service.release_payment(req)
        req.reload()
    record_activity(req, "rental.started")


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
    already_confirmed = (
        req.pickup_confirmation.confirmed_by_owner_at
        if is_owner
        else req.pickup_confirmation.confirmed_by_requester_at
    )
    if already_confirmed:
        raise errors.conflict("Você já confirmou a retirada")

    if is_owner:
        req.update(
            set__pickup_confirmation__confirmed_by_owner_at=utcnow(),
            updated_at=utcnow(),
        )
    else:
        req.update(
            set__pickup_confirmation__confirmed_by_requester_at=utcnow(),
            updated_at=utcnow(),
        )
    req.reload()
    record_activity(req, "rental.pickup_confirmed", actor=current_user)

    if (
        req.pickup_confirmation.confirmed_by_owner_at
        and req.pickup_confirmation.confirmed_by_requester_at
    ):
        _complete_pickup(req)

    return to_response(req, viewer=current_user)


def force_pickup(request_id: str, current_user: User) -> LoanRequestResponse:
    """Owner-only escape hatch: moves the request to 'in_progress' without
    the requester's confirmation, once the owner has waited out the grace
    period since confirming their own side. Flagged via pickup_forced so
    it stays visible on the request going forward."""
    req = get_as_owner(request_id, current_user)
    assert_status(req, "accepted")

    if not req.pickup_confirmation.confirmed_by_owner_at:
        raise errors.conflict("Confirme sua própria retirada antes de forçar")

    grace_hours = get_platform_settings().handoff_confirmation_grace_hours
    elapsed = utcnow() - req.pickup_confirmation.confirmed_by_owner_at
    if elapsed < timedelta(hours=grace_hours):
        raise errors.conflict(
            f"Aguarde {grace_hours}h desde sua confirmação antes de forçar a retirada"
        )

    req.update(set__pickup_confirmation__forced=True, updated_at=utcnow())
    req.reload()
    record_activity(req, "rental.pickup_forced", actor=current_user)
    _complete_pickup(req)
    return to_response(req, viewer=current_user)


def confirm_pickup_by_code(
    request_id: str, current_user: User, code: str, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    """Delivery-only substitute for confirm_pickup: the requester is shown
    this code once the request is accepted, hands it to the owner at the
    door, and the owner typing it in here sets BOTH pickup_confirmed_by_*_at
    fields at once — there is no separate requester-side confirmation step
    for delivery-fulfilled requests."""
    req = get_as_owner(request_id, current_user)
    assert_status(req, "accepted")

    if req.fulfillment_method != "delivery":
        raise errors.bad_request("Este pedido usa retirada presencial")

    if req.item.availability_type == "paid" and req.payment_status != "held":
        raise errors.conflict(
            "Aguardando confirmação do pagamento — a entrega só pode ser "
            "confirmada depois que o Pix for aprovado"
        )

    if req.delivery_confirmation.attempts >= DELIVERY_CODE_MAX_ATTEMPTS:
        raise errors.conflict("Número de tentativas excedido — gere um novo código")

    if code.strip() != req.delivery_confirmation.code:
        req.update(
            inc__delivery_confirmation__attempts=1,
            updated_at=utcnow(),
        )
        raise errors.bad_request("Código incorreto")

    now = utcnow()
    req.update(
        set__pickup_confirmation__confirmed_by_owner_at=now,
        set__pickup_confirmation__confirmed_by_requester_at=now,
        updated_at=now,
    )
    req.reload()
    record_activity(req, "rental.pickup_confirmed", actor=current_user)
    _complete_pickup(req)

    background_tasks.add_task(
        notification_service.create_notification,
        req.requester,
        "request_status",
        "Entrega confirmada",
        req.item.title,
        f"/requests/{req.id}",
    )
    return to_response(req, viewer=current_user)


def regenerate_delivery_code(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    """Owner-only: issues a fresh delivery code and resets the attempt
    counter — the way out once the wrong-code cap is hit."""
    req = get_as_owner(request_id, current_user)
    assert_status(req, "accepted")

    if req.fulfillment_method != "delivery":
        raise errors.bad_request("Este pedido não usa entrega com código")

    req.update(
        delivery_confirmation=DeliveryCode(
            code=_generate_delivery_code(), attempts=0, generated_at=utcnow()
        ),
        updated_at=utcnow(),
    )
    req.reload()
    record_activity(req, "rental.delivery_code_regenerated", actor=current_user)
    background_tasks.add_task(
        notification_service.create_notification,
        req.requester,
        "request_status",
        "Novo código de confirmação gerado",
        req.item.title,
        f"/requests/{req.id}",
    )
    return to_response(req, viewer=current_user)


def _complete_return(req: LoanRequest, background_tasks: BackgroundTasks) -> None:
    req.update(
        status="finished",
        actual_return_date=utcnow(),
        updated_at=utcnow(),
    )
    req.reload()
    recalculate_reliability(req.requester)
    record_activity(req, "rental.finished")
    _notify_status_change(req, background_tasks)


def confirm_return(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    """Either side confirms the item was returned. Same both-sides-required
    rule as confirm_pickup — see force_return for the owner's escape hatch."""
    req = get_as_participant(request_id, current_user)
    assert_status(req, "in_progress")

    is_owner = str(req.owner.id) == str(current_user.id)
    already_confirmed = (
        req.return_confirmation.confirmed_by_owner_at
        if is_owner
        else req.return_confirmation.confirmed_by_requester_at
    )
    if already_confirmed:
        raise errors.conflict("Você já confirmou a devolução")

    if is_owner:
        req.update(
            set__return_confirmation__confirmed_by_owner_at=utcnow(),
            updated_at=utcnow(),
        )
    else:
        req.update(
            set__return_confirmation__confirmed_by_requester_at=utcnow(),
            updated_at=utcnow(),
        )
    req.reload()
    record_activity(req, "rental.return_confirmed", actor=current_user)

    if (
        req.return_confirmation.confirmed_by_owner_at
        and req.return_confirmation.confirmed_by_requester_at
    ):
        _complete_return(req, background_tasks)

    return to_response(req, viewer=current_user)


def force_return(
    request_id: str, current_user: User, background_tasks: BackgroundTasks
) -> LoanRequestResponse:
    """Owner-only escape hatch for the return side — same grace-period rule
    as force_pickup. Flags return_forced."""
    req = get_as_owner(request_id, current_user)
    assert_status(req, "in_progress")

    if not req.return_confirmation.confirmed_by_owner_at:
        raise errors.conflict("Confirme sua própria devolução antes de forçar")

    grace_hours = get_platform_settings().handoff_confirmation_grace_hours
    elapsed = utcnow() - req.return_confirmation.confirmed_by_owner_at
    if elapsed < timedelta(hours=grace_hours):
        raise errors.conflict(
            f"Aguarde {grace_hours}h desde sua confirmação antes de forçar a devolução"
        )

    req.update(set__return_confirmation__forced=True, updated_at=utcnow())
    req.reload()
    record_activity(req, "rental.return_forced", actor=current_user)
    _complete_return(req, background_tasks)
    return to_response(req, viewer=current_user)


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
    record_activity(req, "rental.cancelled", actor=current_user)

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

    return to_response(req, viewer=current_user)
