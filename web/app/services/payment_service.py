import logging

from app.config import settings
from app.models.loan_request import LoanRequest
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import PaymentResponse
from app.services import mercadopago_gateway
from app.services.mercadopago_gateway import MercadoPagoError
from app.utils import errors
from app.utils.time import utcnow

logger = logging.getLogger(__name__)


def _to_response(payment: Payment) -> PaymentResponse:
    return PaymentResponse(
        id=str(payment.id),
        loan_request_id=str(payment.loan_request.id),
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
    gross_amount = round(item.daily_rate * days, 2)
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


def _get_payment(req: LoanRequest) -> Payment:
    payment = Payment.objects(loan_request=req).first()
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

    payment = Payment.objects(loan_request=req).first()
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


def release_payment(req: LoanRequest) -> None:
    """Called once both sides have confirmed pickup (confirm_pickup/
    force_pickup) and payment_status is already 'held' — moves the owner's
    share out of hold."""
    payment = _get_payment(req)
    try:
        mercadopago_gateway.release_payment(payment.mp_payment_id)
    except MercadoPagoError as e:
        raise errors.bad_gateway(
            f"Não foi possível liberar o pagamento agora ({e}). "
            "Tente novamente em instantes."
        ) from e
    payment.update(status="released", released_at=utcnow())
    req.update(payment_status="released", updated_at=utcnow())


def refund_payment(req: LoanRequest) -> None:
    """Called from cancel_request when the item hasn't been picked up yet."""
    payment = _get_payment(req)
    try:
        mercadopago_gateway.refund_payment(payment.mp_payment_id)
    except MercadoPagoError as e:
        raise errors.bad_gateway(
            f"Não foi possível estornar o pagamento agora ({e}). "
            "Tente novamente em instantes."
        ) from e
    payment.update(status="refunded", refunded_at=utcnow())
    req.update(payment_status="refunded", updated_at=utcnow())


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
        payment.loan_request.update(payment_status="held", updated_at=utcnow())
        logger.info("payment held", extra={"mp_payment_id": data_id})
    elif remote_status in ("rejected", "cancelled"):
        payment.update(status="failed")
        payment.loan_request.update(payment_status="failed", updated_at=utcnow())
        logger.warning(
            "payment failed",
            extra={"mp_payment_id": data_id, "mp_remote_status": remote_status},
        )
