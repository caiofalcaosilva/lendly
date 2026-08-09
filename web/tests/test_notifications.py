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


def test_accepting_request_notifies_requester(client, register_user):
    _, owner_token = register_user("dono.notif@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.notif@example.com")
    req = _create_request(client, requester_token, item["id"])

    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    resp = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {requester_token}"}
    )
    assert resp.status_code == 200
    notifs = resp.json()
    assert len(notifs) == 1
    assert notifs[0]["type"] == "request_status"
    assert notifs[0]["read_at"] is None
    assert notifs[0]["link"] == f"/requests/{req['id']}"

    unread = client.get(
        "/notifications/unread-count",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert unread.json()["count"] == 1

    # The owner is a different user and shouldn't see the requester's notification.
    owner_notifs = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert owner_notifs.json() == []


def test_mark_single_notification_read(client, register_user):
    _, owner_token = register_user("dono.marcarlida@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.marcarlida@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    notif_id = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {requester_token}"}
    ).json()[0]["id"]

    resp = client.patch(
        f"/notifications/{notif_id}/read",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["read_at"] is not None

    unread = client.get(
        "/notifications/unread-count",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert unread.json()["count"] == 0


def test_cannot_mark_another_users_notification_read(client, register_user):
    _, owner_token = register_user("dono.outraconta@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.outraconta@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    notif_id = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {requester_token}"}
    ).json()[0]["id"]

    resp = client.patch(
        f"/notifications/{notif_id}/read",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 404


def test_mark_all_read(client, register_user):
    _, owner_token = register_user("dono.marcartodas@example.com")
    item1 = _create_item(client, owner_token, title="Item 1")
    item2 = _create_item(client, owner_token, title="Item 2")
    _, requester_token = register_user("solicitante.marcartodas@example.com")
    req1 = _create_request(client, requester_token, item1["id"])
    req2 = _create_request(
        client,
        requester_token,
        item2["id"],
        pickup_date="2026-09-05T10:00:00",
        expected_return_date="2026-09-06T10:00:00",
    )
    client.patch(
        f"/requests/{req1['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req2['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    resp = client.patch(
        "/notifications/read-all",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["marked"] == 2

    unread = client.get(
        "/notifications/unread-count",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert unread.json()["count"] == 0


def test_disabling_inapp_preference_blocks_notification(client, register_user):
    _, owner_token = register_user("dono.prefsdesligadas@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.prefsdesligadas@example.com")

    off = client.put(
        "/notifications/preferences",
        json={"request_status": False},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert off.status_code == 200
    assert off.json()["inapp_notification_prefs"]["request_status"] is False
    # Email preference is untouched — the two are independent.
    assert off.json()["notification_prefs"]["request_status"] is True

    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    notifs = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {requester_token}"}
    )
    assert notifs.json() == []


def test_new_message_notifies_the_other_participant(client, register_user):
    _, owner_token = register_user("dono.mensagem@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.mensagem@example.com")
    req = _create_request(client, requester_token, item["id"])

    resp = client.post(
        f"/requests/{req['id']}/messages",
        json={"text": "Oi, ainda está disponível?"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert resp.status_code == 201, resp.text

    notifs = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert len(notifs.json()) == 1
    assert notifs.json()[0]["type"] == "new_message"

    # The sender doesn't notify themselves.
    sender_notifs = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {requester_token}"}
    )
    assert sender_notifs.json() == []
