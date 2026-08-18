"""Only module that talks to Twilio directly — same reasoning as
mercadopago_gateway.py: a wrong assumption about the provider's API is
one file to fix, not scattered through the codebase. With
TWILIO_ACCOUNT_SID blank (no real account yet), send_sms() logs the
message instead of sending it — same "inert until configured" pattern as
Google/Mercado Pago, but functional enough in dev to test the whole
verification flow without a real Twilio account."""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

MESSAGES_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"


class SmsGatewayError(Exception):
    pass


def to_e164_br(digits: str) -> str:
    """Accepts digits-only Brazilian phone numbers, with or without the
    country code already present, and returns E.164 (+55DDNNNNNNNNN)."""
    if len(digits) in (12, 13) and digits.startswith("55"):
        return f"+{digits}"
    if len(digits) in (10, 11):
        return f"+55{digits}"
    raise SmsGatewayError("Telefone inválido — use DDD + número")


def send_sms(to_e164: str, message: str) -> None:
    if not settings.TWILIO_ACCOUNT_SID:
        logger.info("SMS (dev, not sent): to=%s message=%s", to_e164, message)
        return

    response = httpx.post(
        MESSAGES_URL.format(sid=settings.TWILIO_ACCOUNT_SID),
        auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
        data={"To": to_e164, "From": settings.TWILIO_FROM_NUMBER, "Body": message},
        timeout=10,
    )
    if response.status_code != 201:
        logger.error(
            "twilio sms send rejected",
            extra={"status": response.status_code, "body": response.text},
        )
        raise SmsGatewayError("Não foi possível enviar o SMS")
