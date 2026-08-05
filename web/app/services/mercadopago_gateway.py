"""Every call to the Mercado Pago API goes through this module — nothing
else in the codebase imports `mercadopago` directly. That's deliberate:
until we have a real developer account (see docs/pagamento-online.md), the
exact request/response shape of a couple of these calls is our best
reading of the SDK/docs, not something we've run against a live sandbox.
Keeping them behind one thin interface means fixing a wrong assumption
later touches this file only, not payment_service.py or the routers.

Confirmed against the installed SDK (mercadopago==3.3.1) source directly:
- OAuth authorization URL building and code-for-token exchange.
- Standard payment creation (`/v1/payments`) returning Pix QR data
  (`point_of_interaction.transaction_data.qr_code` /
  `qr_code_base64`) — this part is well-documented and used widely.
- Advanced Payments (`/v1/advanced_payments`) supporting `disbursements`
  (marketplace split) and `update_release_date` to control exactly when
  a seller's share becomes available — this is the hold-then-release
  mechanism the product needs (charge at accept, release at pickup).

NOT independently confirmed: whether `payment_method_id: "pix"` on an
Advanced Payment returns the same embeddable QR fields as a plain
payment does. It's the most likely reading (Advanced Payments is a
payment-creation endpoint with disbursements layered on, same as
/v1/payments), but it's the first thing to verify once real sandbox
credentials exist — see create_pix_charge() below.
"""

import logging
import uuid

import mercadopago

from app.config import settings
from app.utils.time import utcnow

logger = logging.getLogger(__name__)


class MercadoPagoError(Exception):
    """Raised whenever Mercado Pago's API itself reports failure. The SDK
    does NOT raise on HTTP errors (401, 400, etc.) — every call returns
    {"status": <code>, "response": {...}} regardless, confirmed directly
    against the installed SDK. Every function below must check the status
    before trusting `response` as success data, or a bad/expired token
    would silently produce garbage Payment records (empty QR code, None
    ids) instead of a clear, catchable failure."""


def _sdk(access_token: str | None = None) -> mercadopago.SDK:
    return mercadopago.SDK(access_token or settings.MP_ACCESS_TOKEN)


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


def get_authorization_url(redirect_uri: str, state: str) -> str:
    return (
        _sdk()
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
        _sdk()
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
        _sdk()
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


# ─── Charging the requester, holding, releasing, refunding ───────────────────


def create_pix_charge(
    *,
    external_reference: str,
    payer_email: str,
    gross_amount: float,
    platform_fee_amount: float,
    seller_mp_user_id: str,
) -> dict:
    """Creates the Pix charge for a loan request. Splits `platform_fee_amount`
    to Lendly, the rest to the seller's connected account — but held (not
    released) until release_payment() is called at pickup check-in.

    Returns dict with: mp_payment_id, status, pix_qr_code, pix_qr_code_base64.
    """
    advanced_payment_object = {
        "external_reference": external_reference,
        "payer": {"email": payer_email},
        "payment_method_id": "pix",
        "disbursements": [
            {
                "amount": round(gross_amount - platform_fee_amount, 2),
                "external_reference": external_reference,
                "collector_id": seller_mp_user_id,
                "application_fee": round(platform_fee_amount, 2),
                # Far-future placeholder — real release happens via
                # release_payment() at pickup, not on a timer.
                "money_release_date": "2099-01-01T00:00:00.000-00:00",
            }
        ],
    }
    result = _sdk().advanced_payment().create(advanced_payment_object)
    response = _unwrap(result, "Pix charge creation")
    poi = response.get("point_of_interaction", {}) or {}
    transaction_data = poi.get("transaction_data", {}) or {}
    return {
        "mp_payment_id": str(response.get("id")),
        "status": response.get("status"),
        "pix_qr_code": transaction_data.get("qr_code"),
        "pix_qr_code_base64": transaction_data.get("qr_code_base64"),
    }


def get_payment_status(mp_payment_id: str) -> str:
    """Re-fetches the authoritative status directly from Mercado Pago —
    used by the webhook handler instead of trusting the notification body,
    so a forged POST can't fake an approval even with a guessed valid id."""
    result = _sdk().advanced_payment().get(mp_payment_id)
    return str(_unwrap(result, "payment status lookup").get("status"))


def release_payment(mp_payment_id: str) -> None:
    """Moves the seller's held disbursement into their available balance —
    called the moment the requester's pickup QR scan is confirmed."""
    result = _sdk().advanced_payment().update_release_date(mp_payment_id, utcnow())
    _unwrap(result, "payment release")


def refund_payment(mp_payment_id: str) -> None:
    """Full refund of every disbursement — called only when cancellation
    happens before pickup (payment_status == 'held', status != 'in_progress')."""
    result = _sdk().disbursement_refund().create_all(mp_payment_id, {})
    _unwrap(result, "payment refund")


def new_state_token() -> str:
    """CSRF-protection value for the OAuth `state` param."""
    return uuid.uuid4().hex


def verify_webhook_signature(x_signature: str, x_request_id: str, data_id: str) -> bool:
    """Mercado Pago signs each webhook with an HMAC in the `x-signature`
    header (format: `ts=...,v1=...`), computed over a manifest string built
    from the notification's data.id, the x-request-id header, and the
    timestamp — validated against MP_WEBHOOK_SECRET. Not yet exercised
    against a real webhook payload; the manifest format below follows
    Mercado Pago's published webhook-signature spec and needs confirming
    against a real notification before this gates anything in production.
    """
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
