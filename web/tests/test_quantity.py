def _create_item(client, token, **overrides):
    payload = {
        "title": "Kit de cadeiras",
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


def _accept(client, token, request_id):
    return client.patch(
        f"/requests/{request_id}/accept", headers={"Authorization": f"Bearer {token}"}
    )


def test_single_unit_item_allows_non_overlapping_future_request(client, register_user):
    """The behavior change confirmed with the user: a single-unit item can
    now be booked again for dates that don't overlap an existing active
    request — the old check blocked ANY new request while one was active,
    regardless of dates."""
    _, owner_token = register_user("dono.unidadeunica@example.com")
    item = _create_item(client, owner_token)  # quantity_total defaults to 1
    _, requester1_token = register_user("solicitante1.unidadeunica@example.com")
    _, requester2_token = register_user("solicitante2.unidadeunica@example.com")

    first = _create_request(client, requester1_token, item["id"])
    assert first.status_code == 201
    assert _accept(client, owner_token, first.json()["id"]).status_code == 200

    second = _create_request(
        client,
        requester2_token,
        item["id"],
        pickup_date="2026-10-01T10:00:00",
        expected_return_date="2026-10-03T10:00:00",
    )
    assert second.status_code == 201, second.text


def test_single_unit_item_still_blocks_overlapping_request(client, register_user):
    _, owner_token = register_user("dono.unidadesobrepos@example.com")
    item = _create_item(client, owner_token)
    _, requester1_token = register_user("solicitante1.unidadesobrepos@example.com")
    _, requester2_token = register_user("solicitante2.unidadesobrepos@example.com")

    first = _create_request(client, requester1_token, item["id"])
    assert _accept(client, owner_token, first.json()["id"]).status_code == 200

    second = _create_request(
        client,
        requester2_token,
        item["id"],
        pickup_date="2026-09-02T10:00:00",
        expected_return_date="2026-09-04T10:00:00",
    )
    assert second.status_code == 409


def test_multi_unit_item_blocks_when_quantity_exceeds_stock(client, register_user):
    _, owner_token = register_user("dono.multiplas@example.com")
    item = _create_item(client, owner_token, quantity_total=3)
    _, requester1_token = register_user("solicitante1.multiplas@example.com")
    _, requester2_token = register_user("solicitante2.multiplas@example.com")

    first = _create_request(client, requester1_token, item["id"], quantity=2)
    assert first.status_code == 201, first.text
    assert _accept(client, owner_token, first.json()["id"]).status_code == 200

    # 2 already reserved for overlapping dates — requesting 2 more (total 4)
    # exceeds the 3 in stock.
    second = _create_request(
        client,
        requester2_token,
        item["id"],
        quantity=2,
        pickup_date="2026-09-02T10:00:00",
        expected_return_date="2026-09-04T10:00:00",
    )
    assert second.status_code == 409

    # 1 more (total 3) fits exactly.
    third = _create_request(
        client,
        requester2_token,
        item["id"],
        quantity=1,
        pickup_date="2026-09-02T10:00:00",
        expected_return_date="2026-09-04T10:00:00",
    )
    assert third.status_code == 201, third.text


def test_quantity_over_item_total_is_rejected(client, register_user):
    _, owner_token = register_user("dono.excedeu@example.com")
    item = _create_item(client, owner_token, quantity_total=3)
    _, requester_token = register_user("solicitante.excedeu@example.com")

    resp = _create_request(client, requester_token, item["id"], quantity=5)
    assert resp.status_code == 400


def test_availability_endpoint_reports_free_units(client, register_user):
    _, owner_token = register_user("dono.disponibilidade@example.com")
    item = _create_item(client, owner_token, quantity_total=3)
    _, requester_token = register_user("solicitante.disponibilidade@example.com")

    req = _create_request(client, requester_token, item["id"], quantity=2)
    assert _accept(client, owner_token, req.json()["id"]).status_code == 200

    resp = client.get(
        f"/items/{item['id']}/availability",
        params={
            "pickup_date": "2026-09-01T10:00:00",
            "expected_return_date": "2026-09-03T10:00:00",
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"available_units": 1, "quantity_total": 3}

    # A non-overlapping window shows the full stock again.
    resp2 = client.get(
        f"/items/{item['id']}/availability",
        params={
            "pickup_date": "2026-10-01T10:00:00",
            "expected_return_date": "2026-10-03T10:00:00",
        },
    )
    assert resp2.json() == {"available_units": 3, "quantity_total": 3}


def test_extension_blocked_by_future_accepted_request(client, register_user):
    """Stretching a return date can newly collide with another request
    already accepted for the same item — approve_extension has to re-check
    the extra window, not just push the date through blindly."""
    _, owner_token = register_user("dono.prorrogacaocolisao@example.com")
    item = _create_item(client, owner_token)  # quantity_total=1
    _, alice_token = register_user("alice.prorrogacaocolisao@example.com")
    _, bob_token = register_user("bob.prorrogacaocolisao@example.com")

    alice_req = _create_request(
        client,
        alice_token,
        item["id"],
        pickup_date="2026-09-01T10:00:00",
        expected_return_date="2026-09-05T10:00:00",
    )
    assert alice_req.status_code == 201
    alice_id = alice_req.json()["id"]
    assert _accept(client, owner_token, alice_id).status_code == 200
    client.patch(
        f"/requests/{alice_id}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    started = client.patch(
        f"/requests/{alice_id}/start",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert started.json()["status"] == "in_progress"

    bob_req = _create_request(
        client,
        bob_token,
        item["id"],
        pickup_date="2026-09-06T10:00:00",
        expected_return_date="2026-09-10T10:00:00",
    )
    assert bob_req.status_code == 201, bob_req.text
    assert _accept(client, owner_token, bob_req.json()["id"]).status_code == 200

    ext = client.post(
        f"/requests/{alice_id}/extend",
        json={"new_expected_return_date": "2026-09-08T10:00:00"},
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert ext.status_code == 201, ext.text

    approve = client.patch(
        f"/requests/{alice_id}/extension/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert approve.status_code == 409
