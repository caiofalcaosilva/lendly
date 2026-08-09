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
    resp = client.post(
        "/requests/", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _confirm_pickup(client, req_id, owner_token, requester_token):
    for token in (owner_token, requester_token):
        r = client.patch(
            f"/requests/{req_id}/start", headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 200, r.text


def _notification_titles(client, token):
    resp = client.get("/notifications/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    return [n["title"] for n in resp.json()]


def test_extension_approved_notifies_requester(client, register_user):
    _, owner_token = register_user("dono.prorrogacao@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.prorrogacao@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    _confirm_pickup(client, req["id"], owner_token, requester_token)

    ext = client.post(
        f"/requests/{req['id']}/extend",
        json={"new_expected_return_date": "2026-09-05T10:00:00"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert ext.status_code == 201, ext.text

    approve = client.patch(
        f"/requests/{req['id']}/extension/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert approve.status_code == 200

    titles = _notification_titles(client, requester_token)
    assert "Prorrogação aprovada" in titles


def test_extension_rejected_notifies_requester(client, register_user):
    _, owner_token = register_user("dono.prorrogacaoneg@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.prorrogacaoneg@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    _confirm_pickup(client, req["id"], owner_token, requester_token)

    client.post(
        f"/requests/{req['id']}/extend",
        json={"new_expected_return_date": "2026-09-05T10:00:00"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    reject = client.patch(
        f"/requests/{req['id']}/extension/reject",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert reject.status_code == 200

    titles = _notification_titles(client, requester_token)
    assert "Prorrogação recusada" in titles


def test_cancel_notifies_other_participant(client, register_user):
    _, owner_token = register_user("dono.cancelamento@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.cancelamento@example.com")
    req = _create_request(client, requester_token, item["id"])

    cancel = client.patch(
        f"/requests/{req['id']}/cancel",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert cancel.status_code == 200, cancel.text

    # The requester cancelled, so the owner is the one notified.
    owner_titles = _notification_titles(client, owner_token)
    assert "Solicitação cancelada" in owner_titles
    requester_titles = _notification_titles(client, requester_token)
    assert "Solicitação cancelada" not in requester_titles


def test_vouch_notifies_target_but_not_on_repeat(client, register_user):
    creator_id, creator_token = register_user("criador.aval@example.com")
    target_id, target_token = register_user("alvo.aval@example.com")

    group = client.post(
        "/groups/",
        json={"name": "Vizinhos Teste", "description": "grupo de teste"},
        headers={"Authorization": f"Bearer {creator_token}"},
    ).json()
    invite_code = group["invite_code"]
    join = client.post(
        "/groups/join",
        json={"invite_code": invite_code},
        headers={"Authorization": f"Bearer {target_token}"},
    )
    assert join.status_code == 200, join.text

    vouch = client.post(
        f"/groups/{group['id']}/members/{target_id}/vouch",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert vouch.status_code == 200, vouch.text

    titles = _notification_titles(client, target_token)
    assert any("confirmou que conhece você" in t for t in titles)

    # Re-vouching is a no-op — shouldn't create a second notification.
    client.post(
        f"/groups/{group['id']}/members/{target_id}/vouch",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    titles_after = _notification_titles(client, target_token)
    assert len(titles_after) == len(titles)


def test_favorited_item_price_change_notifies_fan(client, register_user):
    from app.models.user import User

    owner_id, owner_token = register_user("dono.itemmudou@example.com")
    _, fan_token = register_user("fa.itemmudou@example.com")
    # Making an item paid requires a connected Mercado Pago account.
    User.objects(id=owner_id).update(mp_user_id="mp-test-user-id")

    item = _create_item(
        client, owner_token, title="Bicicleta", availability_type="free"
    )
    fav = client.post(
        f"/items/{item['id']}/favorite",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert fav.status_code == 200, fav.text

    update = client.put(
        f"/items/{item['id']}",
        json={"availability_type": "paid", "daily_rate": 15.0},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert update.status_code == 200, update.text

    titles = _notification_titles(client, fan_token)
    assert "Bicicleta mudou" in titles


def test_favorited_item_unrelated_change_does_not_notify(client, register_user):
    _, owner_token = register_user("dono.itemnaomudou@example.com")
    _, fan_token = register_user("fa.itemnaomudou@example.com")

    item = _create_item(client, owner_token, title="Escada")
    client.post(
        f"/items/{item['id']}/favorite",
        headers={"Authorization": f"Bearer {fan_token}"},
    )

    # A description-only edit isn't a price/availability change.
    update = client.put(
        f"/items/{item['id']}",
        json={"description": "Escada de 6 degraus, alumínio"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert update.status_code == 200, update.text

    titles = _notification_titles(client, fan_token)
    assert titles == []
