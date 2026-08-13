from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.payment import Payment
from app.models.user import User
from app.services import payment_service
from app.services.mercadopago_gateway import MercadoPagoError

_MOCK_CHARGE_RESULT = {
    "mp_payment_id": "123",
    "status": "pending",
    "pix_qr_code": "qr-code",
    "pix_qr_code_base64": "base64",
}


def _make_paid_loan_request(quantity=1):
    owner = User(
        name="Dono",
        email="dono.pagamento@example.com",
        password_hash="x",
        is_verified=True,
        mp_user_id="MP-OWNER-123",
    ).save()
    requester = User(
        name="Solicitante", email="solicitante.pagamento@example.com", password_hash="x"
    ).save()
    item = Item(
        owner=owner,
        title="Furadeira",
        category="toys",
        availability_type="paid",
        daily_rate=50.0,
        quantity_total=max(quantity, 1),
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
    assert payment.gross_amount == 100.0  # daily_rate 50 * 2 days
    assert payment.platform_fee_amount == 5.0  # 5% platform fee
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

    with patch.object(payment_service.mercadopago_gateway, "release_payment") as mocked:
        payment_service.release_payment(req)

    mocked.assert_called_once()
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
        daily_rate=50.0,
        **overrides,
    )


def test_price_falls_back_to_daily_rate_without_tiers():
    assert payment_service._calculate_price(_item(), 10) == 500.0


def test_price_uses_weekly_tier_with_daily_remainder():
    item = _item(weekly_rate=300.0)
    # 10 days = 1 week (300) + 3 days (3 * 50 = 150)
    assert payment_service._calculate_price(item, 10) == 450.0


def test_price_uses_monthly_tier_with_weekly_and_daily_remainder():
    item = _item(weekly_rate=300.0, monthly_rate=1000.0)
    # 40 days = 1 month (1000) + 1 week (300) + 3 days (150)
    assert payment_service._calculate_price(item, 40) == 1450.0


def test_price_monthly_tier_without_weekly_falls_through_to_daily():
    item = _item(monthly_rate=1000.0)
    # 40 days = 1 month (1000) + 10 days (500), no weekly tier configured
    assert payment_service._calculate_price(item, 40) == 1500.0


def test_price_exact_multiple_uses_tier_cleanly():
    item = _item(weekly_rate=300.0)
    assert payment_service._calculate_price(item, 7) == 300.0
    assert payment_service._calculate_price(item, 14) == 600.0


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
    with patch.object(payment_service.mercadopago_gateway, "release_payment"):
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
    assert payment.gross_amount == 150.0  # 3 days * daily_rate 50
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
            return_value="approved",
        ),
        patch.object(
            payment_service.mercadopago_gateway, "release_payment"
        ) as mocked_release,
    ):
        payment_service.handle_webhook(
            {"data": {"id": "ext-2"}}, x_signature="sig", x_request_id="req-id"
        )

    mocked_release.assert_called_once()
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
        mp_user_id="MP-OWNER-123",
    ).save()
    requester = User(
        name="Solicitante", email="solicitante.entrega@example.com", password_hash="x"
    ).save()
    item = Item(
        owner=owner,
        title="Furadeira",
        category="toys",
        availability_type="paid",
        daily_rate=50.0,
        fulfillment_options=["delivery"],
        delivery_fee=delivery_fee,
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
    assert payment.gross_amount == 120.0
    assert payment.platform_fee_amount == 6.0  # 5% of 120


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

    assert payment.gross_amount == 100.0  # no delivery fee added


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
    assert payment.gross_amount == 120.0  # the refunded amount includes delivery


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
    assert payment.gross_amount == 300.0
    assert payment.platform_fee_amount == 15.0  # 5% of 300


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
    assert payment.gross_amount == 320.0
