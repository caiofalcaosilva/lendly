def _create_item(client, token, **overrides):
    payload = {
        "title": "Furadeira",
        "description": "Furadeira elétrica",
        "category": "toys",
        "availability_type": "free",
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
    return client.post(
        "/requests/", json=payload, headers={"Authorization": f"Bearer {token}"}
    )


def test_cannot_request_own_item(client, register_user):
    _, token = register_user("dono.proprio@example.com")
    item = _create_item(client, token)
    resp = _create_request(client, token, item["id"])
    assert resp.status_code == 400


def test_create_request_success(client, register_user):
    _, owner_token = register_user("dono.request@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante@example.com")
    resp = _create_request(client, requester_token, item["id"])
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending"
    assert body["item_id"] == item["id"]


def test_conflict_when_item_already_has_active_request(client, register_user):
    _, owner_token = register_user("dono.conflito@example.com")
    item = _create_item(client, owner_token)
    _, requester1 = register_user("solicitante1@example.com")
    _, requester2 = register_user("solicitante2@example.com")

    first = _create_request(client, requester1, item["id"])
    assert first.status_code == 201
    request_id = first.json()["id"]

    accept = client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert accept.status_code == 200

    second = _create_request(
        client,
        requester2,
        item["id"],
        pickup_date="2026-09-05T10:00:00",
        expected_return_date="2026-09-06T10:00:00",
    )
    assert second.status_code == 409


def test_identity_verification_required_blocks_request(client, register_user):
    _, owner_token = register_user("dono.verificacao@example.com")
    item = _create_item(client, owner_token, requires_identity_verification=True)
    _, requester_token = register_user("solicitante.naoverificado@example.com")
    resp = _create_request(client, requester_token, item["id"])
    assert resp.status_code == 403


def test_full_free_item_loan_lifecycle(client, register_user):
    _, owner_token = register_user("dono.ciclo@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.ciclo@example.com")

    create = _create_request(client, requester_token, item["id"])
    assert create.status_code == 201
    request_id = create.json()["id"]

    accept = client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert accept.status_code == 200
    assert accept.json()["status"] == "accepted"

    # Pickup only advances once BOTH sides have confirmed.
    owner_start = client.patch(
        f"/requests/{request_id}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert owner_start.status_code == 200
    assert owner_start.json()["status"] == "accepted"

    requester_start = client.patch(
        f"/requests/{request_id}/start",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert requester_start.status_code == 200
    assert requester_start.json()["status"] == "in_progress"

    # Same both-sides rule for the return.
    owner_finish = client.patch(
        f"/requests/{request_id}/finish",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert owner_finish.status_code == 200
    assert owner_finish.json()["status"] == "in_progress"

    requester_finish = client.patch(
        f"/requests/{request_id}/finish",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert requester_finish.status_code == 200
    assert requester_finish.json()["status"] == "finished"


def test_confirming_pickup_twice_conflicts(client, register_user):
    _, owner_token = register_user("dono.duplaconf@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.duplaconf@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]
    client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    first = client.patch(
        f"/requests/{request_id}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert first.status_code == 200

    second = client.patch(
        f"/requests/{request_id}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert second.status_code == 409


def test_non_participant_cannot_confirm_pickup(client, register_user):
    _, owner_token = register_user("dono.naoparticip@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.naoparticip@example.com")
    _, stranger_token = register_user("estranho.naoparticip@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]
    client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    resp = client.patch(
        f"/requests/{request_id}/start",
        headers={"Authorization": f"Bearer {stranger_token}"},
    )
    assert resp.status_code == 403


def test_force_pickup_blocked_before_grace_period(client, register_user):
    _, owner_token = register_user("dono.forcacedo@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.forcacedo@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]
    client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{request_id}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    force = client.patch(
        f"/requests/{request_id}/start/force",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert force.status_code == 409


def test_force_pickup_allowed_after_grace_period(client, register_user):
    from datetime import timedelta

    from app.models.loan_request import LoanRequest
    from app.utils.time import utcnow

    _, owner_token = register_user("dono.forcaok@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.forcaok@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]
    client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{request_id}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    # Backdate the owner's own confirmation past the grace period instead
    # of waiting for it in real time.
    req = LoanRequest.objects(id=request_id).first()
    req.update(pickup_confirmed_by_owner_at=utcnow() - timedelta(hours=3))

    force = client.patch(
        f"/requests/{request_id}/start/force",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert force.status_code == 200
    body = force.json()
    assert body["status"] == "in_progress"
    assert body["pickup_forced"] is True
