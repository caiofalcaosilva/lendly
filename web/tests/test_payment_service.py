from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.payment import Payment
from app.models.user import MercadoPagoConnection, User
from app.services import payment_service
from app.services.mercadopago_gateway import MercadoPagoError
from app.utils.money import to_cents

_MOCK_CHARGE_RESULT = {
    "mp_payment_id": "123",
    "status": "pending",
    "pix_qr_code": "qr-code",
    "pix_qr_code_base64": "base64",
}


def _make_paid_loan_request(quantity=1, declared_value=None):
    owner = User(
        name="Dono",
        email="dono.pagamento@example.com",
        password_hash="x",
        is_verified=True,
        mp_connection=MercadoPagoConnection(mp_user_id="MP-OWNER-123"),
    ).save()
    requester = User(
        name="Solicitante", email="solicitante.pagamento@example.com", password_hash="x"
    ).save()
    item = Item(
        owner=owner,
        title="Furadeira",
        category="toys",
        availability_type="paid",
        daily_rate_cents=5000,
        quantity_total=max(quantity, 1),
        declared_value_cents=to_cents(declared_value),
    ).save()
    return LoanRequest(
        item=item,
        requester=requester,
        owner=owner,
        pickup_date=datetime(2026, 9, 1),
        expected_return_date=datetime(2026, 9, 3),
        quantity=quantity,
    ).save()


def test_create_payment_splits_fee_correctly(client):
    req = _make_paid_loan_request()
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ) as mocked:
        payment = payment_service.create_payment_for_request(req)

    mocked.assert_called_once()
    assert payment.gross_amount_cents == 10000  # daily_rate 50 * 2 days
    assert payment.platform_fee_amount_cents == 500  # 5% platform fee
    req.reload()
    assert req.payment_status == "processing"


def test_create_payment_gateway_failure_leaves_request_unpaid(client):
    """Regression test: a rejected/unreachable gateway must not leave a
    corrupted Payment record — payment_status stays at its safe 'unpaid'
    default, and no Payment document is created at all."""
    req = _make_paid_loan_request()
    with (
        patch.object(
            payment_service.mercadopago_gateway,
            "create_pix_charge",
            side_effect=MercadoPagoError("token expirado"),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        payment_service.create_payment_for_request(req)

    assert exc_info.value.status_code == 502
    req.reload()
    assert req.payment_status == "unpaid"
    assert Payment.objects(loan_request=req).first() is None


def test_release_payment_updates_status(client):
    req = _make_paid_loan_request()
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        payment_service.create_payment_for_request(req)

    # No gateway call anymore — release_payment is pure bookkeeping now
    # (see its docstring in payment_service.py).
    payment_service.release_payment(req)

    req.reload()
    assert req.payment_status == "released"
    payment = Payment.objects(loan_request=req).first()
    assert payment.status == "released"


# ── Tiered pricing (_calculate_price) ────────────────────────────────────────


def _item(**overrides):
    return Item(
        owner=User(name="x", email=f"x{id(overrides)}@example.com", password_hash="x"),
        title="Kit",
        category="toys",
        availability_type="paid",
        daily_rate_cents=5000,
        **overrides,
    )


def test_price_falls_back_to_daily_rate_without_tiers():
    assert payment_service._calculate_price_cents(_item(), 10) == 50000


def test_price_uses_weekly_tier_with_daily_remainder():
    item = _item(weekly_rate_cents=30000)
    # 10 days = 1 week (300) + 3 days (3 * 50 = 150)
    assert payment_service._calculate_price_cents(item, 10) == 45000


def test_price_uses_monthly_tier_with_weekly_and_daily_remainder():
    item = _item(weekly_rate_cents=30000, monthly_rate_cents=100000)
    # 40 days = 1 month (1000) + 1 week (300) + 3 days (150)
    assert payment_service._calculate_price_cents(item, 40) == 145000


def test_price_monthly_tier_without_weekly_falls_through_to_daily():
    item = _item(monthly_rate_cents=100000)
    # 40 days = 1 month (1000) + 10 days (500), no weekly tier configured
    assert payment_service._calculate_price_cents(item, 40) == 150000


def test_price_exact_multiple_uses_tier_cleanly():
    item = _item(weekly_rate_cents=30000)
    assert payment_service._calculate_price_cents(item, 7) == 30000
    assert payment_service._calculate_price_cents(item, 14) == 60000


# ── Extension payments ───────────────────────────────────────────────────────


def _make_in_progress_paid_request():
    """A paid loan already past pickup — the rental Payment exists and is
    'released', same as any real in_progress paid request, since release
    happens at pickup confirmation, not at extension time."""
    req = _make_paid_loan_request()
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        payment_service.create_payment_for_request(req)
    payment_service.release_payment(req)
    req.update(status="in_progress")
    req.reload()
    return req


def test_create_payment_for_extension_does_not_touch_rental_payment_status(client):
    req = _make_in_progress_paid_request()
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value={**_MOCK_CHARGE_RESULT, "mp_payment_id": "ext-1"},
    ) as mocked:
        payment = payment_service.create_payment_for_extension(req, 3)

    mocked.assert_called_once()
    assert payment.kind == "extension"
    assert payment.gross_amount_cents == 15000  # 3 days * daily_rate 50
    req.reload()
    assert req.payment_status == "released"  # unchanged by the extension charge

    rental = Payment.objects(loan_request=req, kind="rental").first()
    extension = Payment.objects(loan_request=req, kind="extension").first()
    assert rental is not None and extension is not None
    assert rental.id != extension.id


def test_extension_webhook_confirmation_releases_automatically(client):
    req = _make_in_progress_paid_request()
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value={**_MOCK_CHARGE_RESULT, "mp_payment_id": "ext-2"},
    ):
        payment_service.create_payment_for_extension(req, 3)

    with (
        patch.object(
            payment_service.mercadopago_gateway,
            "verify_webhook_signature",
            return_value=True,
        ),
        patch.object(
            payment_service.mercadopago_gateway,
            "get_payment_status",
            return_value="processed",
        ),
    ):
        payment_service.handle_webhook(
            {"data": {"id": "ext-2"}}, x_signature="sig", x_request_id="req-id"
        )

    extension = Payment.objects(loan_request=req, kind="extension").first()
    assert extension.status == "released"
    req.reload()
    # Still whatever the rental payment already had it as — the extension's
    # confirmation must not touch this field.
    assert req.payment_status == "released"


# ── Delivery fee ──────────────────────────────────────────────────────────


def _make_delivery_request(delivery_fee=20.0):
    owner = User(
        name="Dono",
        email="dono.entrega@example.com",
        password_hash="x",
        is_verified=True,
        mp_connection=MercadoPagoConnection(mp_user_id="MP-OWNER-123"),
    ).save()
    requester = User(
        name="Solicitante", email="solicitante.entrega@example.com", password_hash="x"
    ).save()
    item = Item(
        owner=owner,
        title="Furadeira",
        category="toys",
        availability_type="paid",
        daily_rate_cents=5000,
        fulfillment_options=["delivery"],
        delivery_fee_cents=to_cents(delivery_fee),
    ).save()
    return LoanRequest(
        item=item,
        requester=requester,
        owner=owner,
        pickup_date=datetime(2026, 9, 1),
        expected_return_date=datetime(2026, 9, 3),
        fulfillment_method="delivery",
    ).save()


def test_delivery_fee_added_to_gross_amount_and_taxed(client):
    req = _make_delivery_request(delivery_fee=20.0)
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        payment = payment_service.create_payment_for_request(req)

    # daily_rate 50 * 2 days + delivery_fee 20 = 120, taxed as a whole.
    assert payment.gross_amount_cents == 12000
    assert payment.platform_fee_amount_cents == 600  # 5% of 120


def test_delivery_fee_ignored_for_pickup_requests(client):
    req = _make_delivery_request(delivery_fee=20.0)
    req.update(fulfillment_method="pickup")
    req.reload()
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        payment = payment_service.create_payment_for_request(req)

    assert payment.gross_amount_cents == 10000  # no delivery fee added


def test_cancellation_before_pickup_refunds_delivery_fee_too(client):
    """No separate refund logic needed for the delivery fee — it's already
    inside gross_amount, so the existing full-refund-before-pickup path
    covers it for free."""
    req = _make_delivery_request(delivery_fee=20.0)
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        payment_service.create_payment_for_request(req)
    req.update(payment_status="held")
    req.reload()

    with patch.object(payment_service.mercadopago_gateway, "refund_payment") as mocked:
        payment_service.refund_payment(req)

    mocked.assert_called_once()
    payment = Payment.objects(loan_request=req, kind="rental").first()
    assert payment.status == "refunded"
    assert payment.gross_amount_cents == 12000  # the refunded amount includes delivery


# ── Quantity ──────────────────────────────────────────────────────────────


def test_gross_amount_multiplied_by_quantity(client):
    req = _make_paid_loan_request(quantity=3)
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        payment = payment_service.create_payment_for_request(req)

    # daily_rate 50 * 2 days * 3 units = 300
    assert payment.gross_amount_cents == 30000
    assert payment.platform_fee_amount_cents == 1500  # 5% of 300


def test_delivery_fee_not_multiplied_by_quantity(client):
    """One delivery trip covers every unit in the request — the fee is per
    request, not per unit."""
    req = _make_delivery_request(delivery_fee=20.0)
    req.update(quantity=3)
    req.reload()
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        payment = payment_service.create_payment_for_request(req)

    # (daily_rate 50 * 2 days * 3 units) + delivery_fee 20 = 320
    assert payment.gross_amount_cents == 32000


# ── Guarantee fee ─────────────────────────────────────────────────────────


def test_guarantee_fee_charged_when_declared_value_set(client):
    req = _make_paid_loan_request(declared_value=800.0)
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        payment = payment_service.create_payment_for_request(req)

    # base = daily_rate 50 * 2 days = 100; guarantee = 3% of 100 = 3.0
    assert payment.guarantee_fee_amount_cents == 300
    assert payment.gross_amount_cents == 10300
    assert payment.platform_fee_amount_cents == 500  # unaffected — still 5% of the base


def test_no_guarantee_fee_without_declared_value(client):
    req = _make_paid_loan_request()
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        payment = payment_service.create_payment_for_request(req)

    assert payment.guarantee_fee_amount_cents == 0
    assert payment.gross_amount_cents == 10000


def test_guarantee_fee_does_not_leak_into_owner_payout(client):
    """The requester pays the extra 3%, but the owner's disbursed share
    (gross_amount minus whatever platform_fee_amount is passed to the
    gateway) must stay exactly what it would've been without the guarantee
    fee — the fee has to be retained by the platform, not passed through."""
    req = _make_paid_loan_request(declared_value=800.0)
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ) as mocked:
        payment_service.create_payment_for_request(req)

    call_kwargs = mocked.call_args.kwargs
    owner_payout = call_kwargs["gross_amount"] - call_kwargs["marketplace_fee_amount"]
    assert owner_payout == 95.0  # 100 base - 5.0 platform fee, same as without the fee


def test_guarantee_fee_applies_to_extension_charge(client):
    req = _make_in_progress_paid_request()
    Item.objects(id=req.item.id).update(declared_value_cents=80000)
    req.item.reload()
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value={**_MOCK_CHARGE_RESULT, "mp_payment_id": "ext-guarantee"},
    ):
        payment = payment_service.create_payment_for_extension(req, 3)

    # base = 3 days * 50 = 150; guarantee = 3% of 150 = 4.5
    assert payment.guarantee_fee_amount_cents == 450
    assert payment.gross_amount_cents == 15450
