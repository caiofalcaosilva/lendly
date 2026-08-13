from datetime import timedelta
from unittest.mock import patch

from app.models.loan_request import LoanRequest
from app.models.user import User
from app.services import payment_service
from app.utils.time import utcnow

_MOCK_CHARGE_RESULT = {
    "mp_payment_id": "123",
    "status": "pending",
    "pix_qr_code": "qr-code",
    "pix_qr_code_base64": "base64",
}


def _create_item(client, token, **overrides):
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


def _finished_paid_request(client, register_user, suffix, declared_value=800.0):
    owner_id, owner_token = register_user(f"dono.sinistro{suffix}@example.com")
    User.objects(id=owner_id).update(mp_user_id="MP-OWNER-CLAIM")
    item = _create_item(client, owner_token, declared_value=declared_value)
    requester_id, requester_token = register_user(
        f"solicitante.sinistro{suffix}@example.com"
    )
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    requester_headers = {"Authorization": f"Bearer {requester_token}"}

    create = client.post(
        "/requests/",
        json={
            "item_id": item["id"],
            "pickup_date": "2026-09-01T10:00:00",
            "expected_return_date": "2026-09-03T10:00:00",
        },
        headers=requester_headers,
    )
    assert create.status_code == 201, create.text
    request_id = create.json()["id"]

    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        accept = client.patch(f"/requests/{request_id}/accept", headers=owner_headers)
    assert accept.status_code == 200, accept.text

    # confirm_pickup requires payment_status == "held", which only happens
    # once the webhook confirms the Pix charge — simulate that here.
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
    ):
        payment_service.handle_webhook(
            {"data": {"id": _MOCK_CHARGE_RESULT["mp_payment_id"]}},
            x_signature="sig",
            x_request_id="req-id",
        )

    with patch.object(
        payment_service.mercadopago_gateway, "release_payment", return_value=None
    ):
        client.patch(f"/requests/{request_id}/start", headers=owner_headers)
        started = client.patch(
            f"/requests/{request_id}/start", headers=requester_headers
        )
    assert started.json()["status"] == "in_progress"

    client.patch(f"/requests/{request_id}/finish", headers=owner_headers)
    finished = client.patch(f"/requests/{request_id}/finish", headers=requester_headers)
    assert finished.json()["status"] == "finished"

    return {
        "owner_id": owner_id,
        "owner_token": owner_token,
        "owner_headers": owner_headers,
        "requester_id": requester_id,
        "requester_token": requester_token,
        "requester_headers": requester_headers,
        "request_id": request_id,
        "item_id": item["id"],
    }


def _make_admin(user_id: str) -> None:
    User.objects(id=user_id).update(is_admin=True)


def test_owner_can_file_claim_after_finished(client, register_user):
    ctx = _finished_paid_request(client, register_user, "1")
    resp = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={
            "description": "Item veio com a caixa amassada",
            "requested_amount": 200.0,
        },
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending"
    assert body["requested_amount"] == 200.0
    assert body["declared_value"] == 800.0


def test_requester_cannot_file_claim(client, register_user):
    ctx = _finished_paid_request(client, register_user, "2")
    resp = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={
            "description": "Tentando registrar por conta própria",
            "requested_amount": 100.0,
        },
        headers=ctx["requester_headers"],
    )
    assert resp.status_code == 403


def test_claim_blocked_without_declared_value(client, register_user):
    ctx = _finished_paid_request(client, register_user, "3", declared_value=None)
    resp = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={
            "description": "Sem valor de reposição definido",
            "requested_amount": 100.0,
        },
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 400


def test_claim_blocked_before_finished(client, register_user):
    owner_id, owner_token = register_user("dono.sinistronaofinal@example.com")
    User.objects(id=owner_id).update(mp_user_id="MP-OWNER-CLAIM-2")
    item = _create_item(client, owner_token, declared_value=800.0)
    _, requester_token = register_user("solicitante.sinistronaofinal@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    create = client.post(
        "/requests/",
        json={
            "item_id": item["id"],
            "pickup_date": "2026-09-01T10:00:00",
            "expected_return_date": "2026-09-03T10:00:00",
        },
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    request_id = create.json()["id"]
    with patch.object(
        payment_service.mercadopago_gateway,
        "create_pix_charge",
        return_value=_MOCK_CHARGE_RESULT,
    ):
        client.patch(f"/requests/{request_id}/accept", headers=owner_headers)

    resp = client.post(
        f"/requests/{request_id}/claims",
        json={
            "description": "Empréstimo ainda não terminou",
            "requested_amount": 100.0,
        },
        headers=owner_headers,
    )
    assert resp.status_code == 400


def test_claim_amount_over_declared_value_rejected(client, register_user):
    ctx = _finished_paid_request(client, register_user, "4", declared_value=800.0)
    resp = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={"description": "Pedindo mais que o teto", "requested_amount": 900.0},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 400


def test_duplicate_pending_claim_rejected(client, register_user):
    ctx = _finished_paid_request(client, register_user, "5")
    first = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={"description": "Primeiro registro do dano", "requested_amount": 100.0},
        headers=ctx["owner_headers"],
    )
    assert first.status_code == 201
    second = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={"description": "Segunda tentativa duplicada", "requested_amount": 50.0},
        headers=ctx["owner_headers"],
    )
    assert second.status_code == 409


def test_claim_outside_window_rejected(client, register_user):
    ctx = _finished_paid_request(client, register_user, "6")
    LoanRequest.objects(id=ctx["request_id"]).update(
        actual_return_date=utcnow() - timedelta(days=10)
    )
    resp = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={"description": "Prazo já passou", "requested_amount": 100.0},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 400


def test_admin_approve_and_mark_paid_flow(client, register_user):
    ctx = _finished_paid_request(client, register_user, "7")
    create = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={"description": "Pé quebrado na devolução", "requested_amount": 300.0},
        headers=ctx["owner_headers"],
    )
    claim_id = create.json()["id"]

    admin_id, admin_token = register_user("admin.sinistro7@example.com")
    _make_admin(admin_id)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    approve = client.patch(
        f"/claims/{claim_id}/approve",
        json={"approved_amount": 250.0},
        headers=admin_headers,
    )
    assert approve.status_code == 200, approve.text
    assert approve.json()["status"] == "approved"
    assert approve.json()["approved_amount"] == 250.0

    paid = client.patch(f"/claims/{claim_id}/mark-paid", headers=admin_headers)
    assert paid.status_code == 200
    assert paid.json()["status"] == "paid"

    summary = client.get("/claims/fund-summary", headers=admin_headers)
    assert summary.status_code == 200
    body = summary.json()
    assert body["paid_out"] == 250.0
    # This single rental's guarantee fee (3% of a $100 base) is nowhere near
    # the $250 payout — balance goes negative, which is fine: the fund is
    # informational only, approvals aren't capped by it (see approve_claim).
    assert body["collected"] == 3.0
    assert body["balance"] == 3.0 - 250.0


def test_admin_reject_flow(client, register_user):
    ctx = _finished_paid_request(client, register_user, "8")
    create = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={"description": "Dano questionável", "requested_amount": 300.0},
        headers=ctx["owner_headers"],
    )
    claim_id = create.json()["id"]

    admin_id, admin_token = register_user("admin.sinistro8@example.com")
    _make_admin(admin_id)
    reject = client.patch(
        f"/claims/{claim_id}/reject",
        json={"reason": "Fotos não mostram dano compatível"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == "rejected"
    assert reject.json()["rejection_reason"] == "Fotos não mostram dano compatível"


def test_approve_amount_over_declared_value_rejected(client, register_user):
    ctx = _finished_paid_request(client, register_user, "9", declared_value=800.0)
    create = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={"description": "Valor pedido dentro do teto", "requested_amount": 500.0},
        headers=ctx["owner_headers"],
    )
    claim_id = create.json()["id"]

    admin_id, admin_token = register_user("admin.sinistro9@example.com")
    _make_admin(admin_id)
    approve = client.patch(
        f"/claims/{claim_id}/approve",
        json={"approved_amount": 900.0},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve.status_code == 400


def test_non_admin_cannot_approve(client, register_user):
    ctx = _finished_paid_request(client, register_user, "10")
    create = client.post(
        f"/requests/{ctx['request_id']}/claims",
        json={"description": "Tentando aprovar o próprio", "requested_amount": 100.0},
        headers=ctx["owner_headers"],
    )
    claim_id = create.json()["id"]
    resp = client.patch(
        f"/claims/{claim_id}/approve",
        json={"approved_amount": 100.0},
        headers=ctx["owner_headers"],
    )
    assert resp.status_code == 403
