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


def _make_paid_loan_request():
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
    ).save()
    return LoanRequest(
        item=item,
        requester=requester,
        owner=owner,
        pickup_date=datetime(2026, 9, 1),
        expected_return_date=datetime(2026, 9, 3),
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
