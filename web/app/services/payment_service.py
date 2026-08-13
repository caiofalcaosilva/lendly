import logging
import secrets

from app.config import settings
from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import PaymentResponse
from app.services import activity_service, mercadopago_gateway
from app.services.mercadopago_gateway import MercadoPagoError
from app.utils import errors
from app.utils.time import utcnow

logger = logging.getLogger(__name__)


def _calculate_price(item: Item, days: int) -> float:
    """Greedy tiered pricing: whole 30-day months first (if item.monthly_rate
    is set), then whole 7-day weeks (if item.weekly_rate is set), remainder
    at daily_rate. Falls back to plain daily_rate * days when neither tier
    is configured — identical to the pre-tiered-pricing behavior. Months/
    weeks are fixed-size blocks, not calendar-aware, matching how `days`
    itself is already computed (a raw date subtraction, no calendar logic)."""
    remaining = days
    total = 0.0
    if item.monthly_rate:
        months, remaining = divmod(remaining, 30)
        total += months * item.monthly_rate
    if item.weekly_rate:
        weeks, remaining = divmod(remaining, 7)
        total += weeks * item.weekly_rate
    total += remaining * item.daily_rate
    return round(total, 2)


def _record_payment_activity(payment: Payment, event: str) -> None:
    """One Activity per side of the payment (payer + payee) — actor is
    always None here, since every transition is either a webhook
    confirmation or a system-driven consequence of a LoanRequest state
    change, not a single user's direct action."""
    for recipient in (payment.payer, payment.payee):
        activity_service.record(
            recipient=recipient,
            event=event,
            resource_type="payment",
            resource_id=str(payment.id),
            resource_title=payment.loan_request.item.title,
            metadata={
                "gross_amount": payment.gross_amount,
                "platform_fee_amount": payment.platform_fee_amount,
            },
        )


def _to_response(payment: Payment) -> PaymentResponse:
    return PaymentResponse(
        id=str(payment.id),
        loan_request_id=str(payment.loan_request.id),
        kind=payment.kind or "rental",
        status=payment.status,
        gross_amount=payment.gross_amount,
        platform_fee_amount=payment.platform_fee_amount,
        pix_qr_code=payment.pix_qr_code,
        pix_qr_code_base64=payment.pix_qr_code_base64,
        expires_at=payment.expires_at,
        created_at=payment.created_at,
    )


def create_payment_for_request(req: LoanRequest) -> Payment:
    """Called right after the owner accepts a paid item's request (and,
    as a self-healing retry, from get_payment_for_request if that first
    attempt failed). Charges the requester now, holds the owner's share
    until release_payment() is called once both sides confirm pickup
    (confirm_pickup/force_pickup).

    Nothing is written to LoanRequest/Payment until the gateway call
    itself succeeds — if Mercado Pago rejects it, payment_status stays
    'unpaid' (its default), a safe, retriable state rather than a
    corrupted one.
    """
    item = req.item
    days = max((req.expected_return_date - req.pickup_date).days, 1)
    gross_amount = _calculate_price(item, days)
    if req.fulfillment_method == "delivery" and item.delivery_fee:
        # Folded straight into gross_amount — taxed by the same platform
        # fee % as the rental itself, and refunded automatically along with
        # it on a pre-pickup cancellation (see refund_payment).
        gross_amount = round(gross_amount + item.delivery_fee, 2)
    platform_fee_amount = round(gross_amount * settings.PLATFORM_FEE_PERCENT, 2)

    try:
        result = mercadopago_gateway.create_pix_charge(
            external_reference=str(req.id),
            payer_email=req.requester.email,
            gross_amount=gross_amount,
            platform_fee_amount=platform_fee_amount,
            seller_mp_user_id=req.owner.mp_user_id,
        )
    except MercadoPagoError as e:
        raise errors.bad_gateway(
            f"Não foi possível gerar a cobrança Pix agora ({e}). "
            "Tente novamente em instantes."
        ) from e

    payment = Payment(
        loan_request=req,
        kind="rental",
        payer=req.requester,
        payee=req.owner,
        gross_amount=gross_amount,
        platform_fee_amount=platform_fee_amount,
        status="pending",
        mp_payment_id=result["mp_payment_id"],
        pix_qr_code=result["pix_qr_code"],
        pix_qr_code_base64=result["pix_qr_code_base64"],
    )
    payment.save()

    req.update(payment_status="processing", updated_at=utcnow())
    return payment


def create_payment_for_extension(req: LoanRequest, additional_days: int) -> Payment:
    """Called from approve_extension when the item is paid — charges the
    requester for the extra days via a second, separate Pix charge. Unlike
    the rental charge, this one is released to the owner automatically as
    soon as Mercado Pago confirms it (see handle_webhook) instead of
    waiting for a pickup-style confirmation — there's no equivalent handoff
    event left to gate it on, the extra days were already granted the
    moment the owner approved the extension."""
    item = req.item
    gross_amount = _calculate_price(item, additional_days)
    platform_fee_amount = round(gross_amount * settings.PLATFORM_FEE_PERCENT, 2)

    try:
        result = mercadopago_gateway.create_pix_charge(
            # str(req.id) alone is already used by the original rental charge —
            # each extension needs its own unique reference.
            external_reference=f"{req.id}-ext-{secrets.token_hex(4)}",
            payer_email=req.requester.email,
            gross_amount=gross_amount,
            platform_fee_amount=platform_fee_amount,
            seller_mp_user_id=req.owner.mp_user_id,
        )
    except MercadoPagoError as e:
        raise errors.bad_gateway(
            f"Não foi possível gerar a cobrança da prorrogação agora ({e}). "
            "Tente novamente em instantes."
        ) from e

    payment = Payment(
        loan_request=req,
        kind="extension",
        payer=req.requester,
        payee=req.owner,
        gross_amount=gross_amount,
        platform_fee_amount=platform_fee_amount,
        status="pending",
        mp_payment_id=result["mp_payment_id"],
        pix_qr_code=result["pix_qr_code"],
        pix_qr_code_base64=result["pix_qr_code_base64"],
    )
    payment.save()
    return payment


def _get_payment(req: LoanRequest, kind: str = "rental") -> Payment:
    payment = (
        Payment.objects(loan_request=req, kind=kind).order_by("-created_at").first()
    )
    if not payment:
        raise errors.not_found("Payment not found")
    return payment


def get_payment_for_request(request_id: str, current_user: User) -> PaymentResponse:
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise errors.not_found("Request not found")
    is_participant = str(req.requester.id) == str(current_user.id) or str(
        req.owner.id
    ) == str(current_user.id)
    if not is_participant:
        raise errors.forbidden("Access denied")

    payment = Payment.objects(loan_request=req, kind="rental").first()
    if (
        not payment
        and req.status == "accepted"
        and req.payment_status == "unpaid"
        and req.item.availability_type == "paid"
    ):
        # Self-healing retry: the charge at accept_request time must have failed.
        payment = create_payment_for_request(req)

    if not payment:
        raise errors.not_found("Payment not found")
    return _to_response(payment)


def get_extension_payment_for_request(
    request_id: str, current_user: User
) -> PaymentResponse:
    """The most recent extension charge for this request, if any. No
    self-healing retry here (unlike get_payment_for_request) — if the
    gateway call inside approve_extension fails, that's a known, accepted
    limitation for now rather than something this endpoint tries to
    recover from automatically."""
    req = LoanRequest.objects(id=request_id).first()
    if not req:
        raise errors.not_found("Request not found")
    is_participant = str(req.requester.id) == str(current_user.id) or str(
        req.owner.id
    ) == str(current_user.id)
    if not is_participant:
        raise errors.forbidden("Access denied")

    payment = _get_payment(req, kind="extension")
    return _to_response(payment)


def _release_payment_doc(payment: Payment) -> None:
    mercadopago_gateway.release_payment(payment.mp_payment_id)
    payment.update(status="released", released_at=utcnow())
    _record_payment_activity(payment, "payment.released")


def release_payment(req: LoanRequest) -> None:
    """Called once both sides have confirmed pickup (confirm_pickup/
    force_pickup) and payment_status is already 'held' — moves the owner's
    share out of hold."""
    payment = _get_payment(req, kind="rental")
    try:
        _release_payment_doc(payment)
    except MercadoPagoError as e:
        raise errors.bad_gateway(
            f"Não foi possível liberar o pagamento agora ({e}). "
            "Tente novamente em instantes."
        ) from e
    req.update(payment_status="released", updated_at=utcnow())


def refund_payment(req: LoanRequest) -> None:
    """Called from cancel_request when the item hasn't been picked up yet."""
    payment = _get_payment(req, kind="rental")
    try:
        mercadopago_gateway.refund_payment(payment.mp_payment_id)
    except MercadoPagoError as e:
        raise errors.bad_gateway(
            f"Não foi possível estornar o pagamento agora ({e}). "
            "Tente novamente em instantes."
        ) from e
    payment.update(status="refunded", refunded_at=utcnow())
    req.update(payment_status="refunded", updated_at=utcnow())
    _record_payment_activity(payment, "payment.refunded")


def handle_webhook(payload: dict, x_signature: str, x_request_id: str) -> None:
    """Mercado Pago webhooks are thin notifications ("something with this id
    changed") — we re-fetch the authoritative status from their API rather
    than trusting anything in the notification body itself, so a forged
    POST can't fake an approval even if it guessed a real payment id.
    """
    data_id = str((payload.get("data") or {}).get("id") or "")
    if not data_id:
        return

    if not mercadopago_gateway.verify_webhook_signature(
        x_signature, x_request_id, data_id
    ):
        logger.warning(
            "webhook signature verification failed",
            extra={"mp_payment_id": data_id, "x_request_id": x_request_id},
        )
        raise errors.unauthorized("Invalid webhook signature")

    payment = Payment.objects(mp_payment_id=data_id).first()
    if not payment or payment.status != "pending":
        # Not ours, or already processed — webhooks can be redelivered.
        return

    try:
        remote_status = mercadopago_gateway.get_payment_status(data_id)
    except MercadoPagoError as e:
        raise errors.bad_gateway(
            f"Não foi possível confirmar o status do pagamento agora ({e})."
        ) from e

    if remote_status == "approved":
        payment.update(status="held", held_at=utcnow())
        # payment_status on the LoanRequest tracks the rental charge only —
        # it's what gates confirm_pickup. An extension payment reaching
        # "held" must not overwrite it (the rental payment may already be
        # 'released' by this point, since extensions only happen once the
        # loan is already in_progress).
        if payment.kind == "rental":
            payment.loan_request.update(payment_status="held", updated_at=utcnow())
        _record_payment_activity(payment, "payment.held")
        logger.info("payment held", extra={"mp_payment_id": data_id})

        if payment.kind == "extension":
            # No escrow gate applies to extensions — the extra days were
            # already granted when the owner approved, so release as soon
            # as the charge itself is confirmed instead of waiting for some
            # other event.
            try:
                _release_payment_doc(payment)
            except MercadoPagoError as e:
                logger.error(
                    "extension payment release failed, left held for manual follow-up",
                    extra={"mp_payment_id": data_id, "error": str(e)},
                )
    elif remote_status in ("rejected", "cancelled"):
        payment.update(status="failed")
        if payment.kind == "rental":
            payment.loan_request.update(payment_status="failed", updated_at=utcnow())
        _record_payment_activity(payment, "payment.failed")
        logger.warning(
            "payment failed",
            extra={"mp_payment_id": data_id, "mp_remote_status": remote_status},
        )
