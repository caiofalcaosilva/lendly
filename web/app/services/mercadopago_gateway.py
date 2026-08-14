"""Only module that imports `mercadopago` directly, so a wrong assumption
is one file to fix. Uses the Orders API (POST /v1/orders) rather than the
older Advanced Payments API (/v1/advanced_payments) that Lendly originally
shipped against — that one no longer appears in Mercado Pago's own docs
(its reference page 404s live) and the app the platform is registered
under was provisioned for Orders + Checkout Transparente. Confirmed live
against a real sandbox app on 2026-08-14 — see docs/pagamento-online.md.

Charging functions authenticate as the connected SELLER's own OAuth access
token (see mp_connect_service.get_valid_access_token), not the platform's —
`marketplace_fee` is what the platform keeps, the rest settles straight to
the seller. Pix orders reject capture_mode="manual" outright (confirmed:
the API's validation error names only credit_card/debit_card/wallet as
valid there), so unlike the old Advanced Payments flow there is no
"hold, then release at pickup" step anymore — the seller's share lands the
moment the Pix is confirmed. See handle_webhook in payment_service.py for
how the payment_status state machine adapted to that."""

import logging
import uuid

import mercadopago

from app.config import settings

logger = logging.getLogger(__name__)


class MercadoPagoError(Exception):
    """The SDK never raises on its own HTTP errors — every call returns
    {"status": <code>, "response": {...}} regardless, so _unwrap() below
    is what turns a bad status into an actual exception."""


def _sdk(access_token: str) -> mercadopago.SDK:
    return mercadopago.SDK(access_token)


def _unwrap(result: dict, action: str) -> dict:
    if result.get("status") not in (200, 201):
        error = (result.get("response") or {}).get("message") or "Erro desconhecido"
        logger.error(
            "mercadopago request rejected",
            extra={
                "mp_action": action,
                "mp_status": result.get("status"),
                "mp_error": error,
            },
        )
        raise MercadoPagoError(
            f"Mercado Pago rejected {action}: {error} (HTTP {result.get('status')})"
        )
    return result["response"]


# ─── OAuth (seller connects their own Mercado Pago account) ──────────────────
# Unchanged from the Advanced Payments-era integration — same endpoints,
# still run as the platform's own app (settings.MP_ACCESS_TOKEN).


def get_authorization_url(redirect_uri: str, state: str) -> str:
    return (
        _sdk(settings.MP_ACCESS_TOKEN)
        .oauth()
        .get_authorization_url(
            app_id=settings.MP_APP_ID,
            redirect_uri=redirect_uri,
            random_id=state,
        )
    )


def exchange_oauth_code(code: str, redirect_uri: str) -> dict:
    """Returns dict with access_token, refresh_token, user_id, expires_in."""
    result = (
        _sdk(settings.MP_ACCESS_TOKEN)
        .oauth()
        .create(
            {
                "client_id": settings.MP_APP_ID,
                "client_secret": settings.MP_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
        )
    )
    return _unwrap(result, "OAuth code exchange")


def refresh_oauth_token(refresh_token: str) -> dict:
    result = (
        _sdk(settings.MP_ACCESS_TOKEN)
        .oauth()
        .refresh(
            {
                "client_id": settings.MP_APP_ID,
                "client_secret": settings.MP_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            }
        )
    )
    return _unwrap(result, "OAuth token refresh")


# ─── Charging the requester, checking status, refunding ──────────────────────
# All three run as the seller (seller_access_token), since the order (and
# whatever it's later queried/refunded through) belongs to whichever
# account created it.


def create_pix_charge(
    *,
    external_reference: str,
    payer_email: str,
    gross_amount: float,
    marketplace_fee_amount: float,
    seller_access_token: str,
) -> dict:
    """Creates the Pix order for a loan request, run as the seller with
    `marketplace_fee` withheld for the platform — the rest settles to the
    seller immediately once Mercado Pago confirms the Pix (see module
    docstring: there's no delayed-release step for Pix in this API).

    Returns dict with: mp_payment_id, status, pix_qr_code, pix_qr_code_base64.
    """
    order_object = {
        "type": "online",
        "total_amount": f"{gross_amount:.2f}",
        "external_reference": external_reference,
        "processing_mode": "automatic",
        "marketplace_fee": f"{marketplace_fee_amount:.2f}",
        "transactions": {
            "payments": [
                {
                    "amount": f"{gross_amount:.2f}",
                    "payment_method": {"id": "pix", "type": "bank_transfer"},
                }
            ]
        },
        "payer": {"email": payer_email},
    }
    result = _sdk(seller_access_token).order().create(order_object)
    response = _unwrap(result, "Pix order creation")
    payment = ((response.get("transactions") or {}).get("payments") or [{}])[0]
    payment_method = payment.get("payment_method") or {}
    return {
        "mp_payment_id": str(response.get("id")),
        "status": response.get("status"),
        "pix_qr_code": payment_method.get("qr_code"),
        "pix_qr_code_base64": payment_method.get("qr_code_base64"),
    }


def get_payment_status(mp_payment_id: str, seller_access_token: str) -> str:
    """Re-fetches the authoritative status directly from Mercado Pago —
    used by the webhook handler instead of trusting the notification body,
    so a forged POST can't fake an approval even with a guessed valid id."""
    result = _sdk(seller_access_token).order().get(mp_payment_id)
    return str(_unwrap(result, "payment status lookup").get("status"))


def refund_payment(mp_payment_id: str, seller_access_token: str) -> None:
    """Full refund — called only when cancellation happens before pickup
    (payment_status == 'held', status != 'in_progress'). Since the seller's
    share may already have settled to their account by this point (no more
    delayed release for Pix, see module docstring), this relies on Mercado
    Pago's marketplace refund behavior clawing that back automatically —
    confirmed against the sandbox (see docs/pagamento-online.md), not yet
    exercised against a real settled seller balance."""
    result = _sdk(seller_access_token).order().refund(mp_payment_id)
    _unwrap(result, "payment refund")


def new_state_token() -> str:
    """CSRF-protection value for the OAuth `state` param."""
    return uuid.uuid4().hex


def verify_webhook_signature(x_signature: str, x_request_id: str, data_id: str) -> bool:
    """HMAC in `x-signature` (format `ts=...,v1=...`) against
    MP_WEBHOOK_SECRET — per Mercado Pago's spec, unconfirmed against a
    real webhook payload."""
    import hashlib
    import hmac

    if not settings.MP_WEBHOOK_SECRET:
        return False

    parts = dict(p.split("=", 1) for p in x_signature.split(",") if "=" in p)
    ts = parts.get("ts")
    v1 = parts.get("v1")
    if not ts or not v1:
        return False

    manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
    computed = hmac.new(
        settings.MP_WEBHOOK_SECRET.encode(), manifest.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, v1)
