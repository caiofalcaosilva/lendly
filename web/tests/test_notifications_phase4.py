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


def test_new_request_notifies_owner(client, register_user):
    _, owner_token = register_user("dono.novasolicitacao@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.novasolicitacao@example.com")

    req = _create_request(client, requester_token, item["id"])
    assert req["status"] == "pending"

    owner_titles = _notification_titles(client, owner_token)
    assert "Nova solicitação recebida" in owner_titles
    # The requester who just created it doesn't notify themselves.
    requester_titles = _notification_titles(client, requester_token)
    assert "Nova solicitação recebida" not in requester_titles


def test_finished_loan_notifies_both_sides(client, register_user):
    _, owner_token = register_user("dono.ambosfinalizado@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("solicitante.ambosfinalizado@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    _confirm_pickup(client, req["id"], owner_token, requester_token)

    # Owner confirms return first, requester confirms last — the owner
    # triggered nothing directly by going first, but should still hear
    # about the loan actually finishing once the requester closes it out.
    client.patch(
        f"/requests/{req['id']}/finish",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    finish = client.patch(
        f"/requests/{req['id']}/finish",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert finish.status_code == 200
    assert finish.json()["status"] == "finished"

    assert "Empréstimo finalizado" in _notification_titles(client, owner_token)
    assert "Empréstimo finalizado" in _notification_titles(client, requester_token)


def test_notifications_cursor_pagination_is_stable_under_inserts(client, register_user):
    user_id, token = register_user("cursor.paginacao@example.com")

    from app.models.notification import Notification
    from app.models.user import User

    user = User.objects(id=user_id).first()
    # Seed 5 notifications directly — cheap and deterministic, no need to
    # drive real triggers just to get rows to paginate over.
    for i in range(5):
        Notification(recipient=user, type="request_status", title=f"Notif {i}").save()

    first_page = client.get(
        "/notifications/",
        params={"limit": 2},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert len(first_page) == 2
    last_id = first_page[-1]["id"]

    # A brand-new notification lands "at the top" between page loads —
    # skip-based pagination would shift and duplicate/skip a row here;
    # cursor-based must not.
    Notification(recipient=user, type="request_status", title="Notif nova").save()

    second_page = client.get(
        "/notifications/",
        params={"before_id": last_id, "limit": 2},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert len(second_page) == 2
    first_page_ids = {n["id"] for n in first_page}
    second_page_ids = {n["id"] for n in second_page}
    assert first_page_ids.isdisjoint(second_page_ids)
