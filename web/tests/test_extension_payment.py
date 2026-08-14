from unittest.mock import patch

from app.models.user import User
from app.services import payment_service

_MOCK_CHARGE_RESULT = {
    "status": "pending",
    "pix_qr_code": "qr-code",
    "pix_qr_code_base64": "base64",
}


def _create_paid_item(client, owner_id, token, **overrides):
    User.objects(id=owner_id).update(mp_user_id="mp-test-user-id")
    payload = {
        "title": "Furadeira",
        "category": "toys",
        "availability_type": "paid",
        "daily_rate": 50.0,
        "photos": [],
        "group_ids": [],
        "is_public": True,
        "available_days": [],
        **overrides,
    }
    resp = client.post(
        "/items/", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_request(client, token, item_id, **overrides):
    payload = {
        "item_id": item_id,
        "pickup_date": "2026-09-01T10:00:00",
        "expected_return_date": "2026-09-03T10:00:00",
        **overrides,
    }
    resp = client.post(
        "/requests/", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _confirm_pickup_paid(client, req_id, owner_token, requester_token):
    # Both sides mark pickup — payment_status must already be "held" for
    # this to succeed, so tests calling this patch payment_status directly
    # first (mirrors test_payment_service.py's approach of not mocking the
    # full webhook round-trip for every test that just needs a released
    # rental payment as a starting point).
    for token in (owner_token, requester_token):
        r = client.patch(
            f"/requests/{req_id}/start", headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 200, r.text


def test_approving_extension_on_paid_item_creates_extension_charge(
    client, register_user
):
    owner_id, owner_token = register_user("dono.prorrogacaopaga@example.com")
    item = _create_paid_item(client, owner_id, owner_token)
    _, requester_token = register_user("solicitante.prorrogacaopaga@example.com")
    req = _create_request(client, requester_token, item["id"])

    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value={**_MOCK_CHARGE_RESULT, "mp_payment_id": "rental-1"},
    ):
        accept = client.patch(
            f"/requests/{req['id']}/accept",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
    assert accept.status_code == 200

    # Simulate the Pix confirmation for the rental charge without going
    # through the webhook — same shortcut test_payment_service.py's own
    # release test effectively relies on (payment_status "held" is the
    # only precondition confirm_pickup checks).
    from app.models.loan_request import LoanRequest

    LoanRequest.objects(id=req["id"]).update(payment_status="held")

    # release_payment is pure bookkeeping now — no gateway call to mock
    # (see its docstring in payment_service.py).
    _confirm_pickup_paid(client, req["id"], owner_token, requester_token)

    get_before = client.get(
        f"/requests/{req['id']}", headers={"Authorization": f"Bearer {requester_token}"}
    ).json()
    assert get_before["has_pending_extension_payment"] is False

    ext = client.post(
        f"/requests/{req['id']}/extend",
        json={"new_expected_return_date": "2026-09-06T10:00:00"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert ext.status_code == 201, ext.text

    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value={**_MOCK_CHARGE_RESULT, "mp_payment_id": "ext-1"},
    ) as mocked:
        approve = client.patch(
            f"/requests/{req['id']}/extension/approve",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
    assert approve.status_code == 200
    mocked.assert_called_once()

    get_after = client.get(
        f"/requests/{req['id']}", headers={"Authorization": f"Bearer {requester_token}"}
    ).json()
    assert get_after["has_pending_extension_payment"] is True
    # payment_status still reflects the (already released) rental payment —
    # untouched by the extension charge just created.
    assert get_after["payment_status"] == "released"

    payment = client.get(
        f"/requests/{req['id']}/extension-payment",
        headers={"Authorization": f"Bearer {requester_token}"},
    ).json()
    assert payment["kind"] == "extension"
    assert payment["gross_amount"] == 150.0  # 3 extra days * daily_rate 50


def test_approving_extension_on_free_item_creates_no_charge(client, register_user):
    """Free items keep working exactly as before — no Payment at all."""
    _, owner_token = register_user("dono.prorrogacaogratis@example.com")
    item_payload = {
        "title": "Furadeira",
        "category": "toys",
        "availability_type": "free",
        "photos": [],
        "group_ids": [],
        "is_public": True,
        "available_days": [],
    }
    item = client.post(
        "/items/",
        json=item_payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()
    _, requester_token = register_user("solicitante.prorrogacaogratis@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    _confirm_pickup_paid(client, req["id"], owner_token, requester_token)

    ext = client.post(
        f"/requests/{req['id']}/extend",
        json={"new_expected_return_date": "2026-09-06T10:00:00"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert ext.status_code == 201, ext.text

    approve = client.patch(
        f"/requests/{req['id']}/extension/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert approve.status_code == 200
    assert approve.json()["has_pending_extension_payment"] is False

    no_payment = client.get(
        f"/requests/{req['id']}/extension-payment",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert no_payment.status_code == 404
