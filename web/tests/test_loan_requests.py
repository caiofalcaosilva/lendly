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


# ── Fulfillment options + delivery confirmation code ────────────────────────


def _get(client, token, request_id):
    return client.get(
        f"/requests/{request_id}", headers={"Authorization": f"Bearer {token}"}
    )


def test_fulfillment_method_resolved_automatically_for_single_option_item(
    client, register_user
):
    """Item only accepts pickup (the default) — no method needs to be
    chosen, and none was asked for."""
    _, owner_token = register_user("dono.fulfillmentunico@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.fulfillmentunico@example.com")

    resp = _create_request(client, requester_token, item["id"])
    assert resp.status_code == 201, resp.text
    assert resp.json()["fulfillment_method"] == "pickup"


def test_fulfillment_method_required_when_item_has_both_options(client, register_user):
    _, owner_token = register_user("dono.fulfillmentduplo@example.com")
    item = _create_item(client, owner_token, fulfillment_options=["pickup", "delivery"])
    _, requester_token = register_user("solicitante.fulfillmentduplo@example.com")

    without_choice = _create_request(client, requester_token, item["id"])
    assert without_choice.status_code == 400

    with_choice = _create_request(
        client, requester_token, item["id"], fulfillment_method="delivery"
    )
    assert with_choice.status_code == 201, with_choice.text
    assert with_choice.json()["fulfillment_method"] == "delivery"


def test_delivery_code_generated_on_accept_and_hidden_from_owner(client, register_user):
    _, owner_token = register_user("dono.codigo@example.com")
    item = _create_item(client, owner_token, fulfillment_options=["delivery"])
    _, requester_token = register_user("solicitante.codigo@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]

    accept = client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert accept.status_code == 200
    assert accept.json()["fulfillment_method"] == "delivery"

    as_requester = _get(client, requester_token, request_id).json()
    assert as_requester["delivery_confirmation_code"] is not None
    assert len(as_requester["delivery_confirmation_code"]) == 6
    assert as_requester["delivery_confirmation_code_max_attempts"] == 5

    as_owner = _get(client, owner_token, request_id).json()
    assert as_owner["delivery_confirmation_code"] is None


def test_confirm_pickup_by_code_completes_both_sides(client, register_user):
    _, owner_token = register_user("dono.codigocerto@example.com")
    item = _create_item(client, owner_token, fulfillment_options=["delivery"])
    _, requester_token = register_user("solicitante.codigocerto@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]
    client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    code = _get(client, requester_token, request_id).json()[
        "delivery_confirmation_code"
    ]

    resp = client.patch(
        f"/requests/{request_id}/start/code",
        json={"code": code},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "in_progress"
    assert body["pickup_confirmed_by_owner_at"] is not None
    assert body["pickup_confirmed_by_requester_at"] is not None


def test_confirm_pickup_by_code_wrong_code_increments_attempts(client, register_user):
    _, owner_token = register_user("dono.codigoerrado@example.com")
    item = _create_item(client, owner_token, fulfillment_options=["delivery"])
    _, requester_token = register_user("solicitante.codigoerrado@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]
    client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    resp = client.patch(
        f"/requests/{request_id}/start/code",
        json={"code": "000000"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 400

    as_requester = _get(client, requester_token, request_id).json()
    assert as_requester["delivery_confirmation_code_attempts"] == 1


def test_confirm_pickup_by_code_exceeds_attempt_cap(client, register_user):
    _, owner_token = register_user("dono.codigoestourado@example.com")
    item = _create_item(client, owner_token, fulfillment_options=["delivery"])
    _, requester_token = register_user("solicitante.codigoestourado@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]
    client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    code = _get(client, requester_token, request_id).json()[
        "delivery_confirmation_code"
    ]

    for _ in range(5):
        resp = client.patch(
            f"/requests/{request_id}/start/code",
            json={"code": "000000"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert resp.status_code == 400

    # Cap hit — even the correct code is now rejected until regenerated.
    blocked = client.patch(
        f"/requests/{request_id}/start/code",
        json={"code": code},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert blocked.status_code == 409


def test_regenerate_delivery_code_resets_attempts(client, register_user):
    _, owner_token = register_user("dono.codigoregenera@example.com")
    item = _create_item(client, owner_token, fulfillment_options=["delivery"])
    _, requester_token = register_user("solicitante.codigoregenera@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]
    client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    old_code = _get(client, requester_token, request_id).json()[
        "delivery_confirmation_code"
    ]

    for _ in range(5):
        client.patch(
            f"/requests/{request_id}/start/code",
            json={"code": "000000"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

    regen = client.patch(
        f"/requests/{request_id}/start/code/regenerate",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert regen.status_code == 200
    assert regen.json()["delivery_confirmation_code_attempts"] == 0

    new_code = _get(client, requester_token, request_id).json()[
        "delivery_confirmation_code"
    ]
    assert new_code != old_code

    resp = client.patch(
        f"/requests/{request_id}/start/code",
        json={"code": new_code},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"


def test_non_owner_cannot_confirm_pickup_by_code(client, register_user):
    _, owner_token = register_user("dono.codigonaodono@example.com")
    item = _create_item(client, owner_token, fulfillment_options=["delivery"])
    _, requester_token = register_user("solicitante.codigonaodono@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]
    client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    resp = client.patch(
        f"/requests/{request_id}/start/code",
        json={"code": "123456"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert resp.status_code == 403


def test_pickup_fulfilled_request_unaffected_by_code_flow(client, register_user):
    """Items that only accept pickup keep the original dual-tap flow, and
    the code endpoint refuses to touch them at all."""
    _, owner_token = register_user("dono.somenteretirada@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.somenteretirada@example.com")

    request_id = _create_request(client, requester_token, item["id"]).json()["id"]
    client.patch(
        f"/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    code_attempt = client.patch(
        f"/requests/{request_id}/start/code",
        json={"code": "123456"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert code_attempt.status_code == 400

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
