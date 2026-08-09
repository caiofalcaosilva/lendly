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


def _notification_titles(client, token):
    resp = client.get("/notifications/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    return [n["title"] for n in resp.json()]


def test_new_login_notifies_bell(client, register_user):
    email = "login.sino@example.com"
    register_user(email)

    login = client.post(
        "/auth/login", json={"email": email, "password": "SenhaForte123!"}
    )
    assert login.status_code == 200, login.text

    titles = _notification_titles(client, login.json()["access_token"])
    assert "Novo login detectado" in titles


def test_item_deletion_notifies_fans(client, register_user):
    _, owner_token = register_user("dono.itemremovido@example.com")
    _, fan_token = register_user("fa.itemremovido@example.com")
    item = _create_item(client, owner_token, title="Serra")
    client.post(
        f"/items/{item['id']}/favorite",
        headers={"Authorization": f"Bearer {fan_token}"},
    )

    resp = client.delete(
        f"/items/{item['id']}", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 204

    titles = _notification_titles(client, fan_token)
    assert "Serra foi removido" in titles


def test_item_pause_notifies_fans(client, register_user):
    _, owner_token = register_user("dono.itempausado@example.com")
    _, fan_token = register_user("fa.itempausado@example.com")
    item = _create_item(client, owner_token, title="Escada")
    client.post(
        f"/items/{item['id']}/favorite",
        headers={"Authorization": f"Bearer {fan_token}"},
    )

    resp = client.patch(
        f"/items/{item['id']}/deactivate",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 200

    titles = _notification_titles(client, fan_token)
    assert "Escada foi pausado" in titles


def test_list_notifications_filters_by_type(client, register_user):
    user_id, token = register_user("filtro.tipo@example.com")

    from app.models.notification import Notification
    from app.models.user import User

    user = User.objects(id=user_id).first()
    Notification(recipient=user, type="request_status", title="Status A").save()
    Notification(recipient=user, type="new_message", title="Mensagem A").save()

    resp = client.get(
        "/notifications/",
        params={"type": "new_message"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Mensagem A"


def test_list_notifications_rejects_invalid_type(client, register_user):
    _, token = register_user("filtro.invalido@example.com")

    resp = client.get(
        "/notifications/",
        params={"type": "not_a_real_type"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


def test_delete_single_notification(client, register_user):
    user_id, token = register_user("excluir.individual@example.com")

    from app.models.notification import Notification
    from app.models.user import User

    user = User.objects(id=user_id).first()
    notif = Notification(
        recipient=user, type="request_status", title="Para excluir"
    ).save()

    resp = client.delete(
        f"/notifications/{notif.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 204
    assert _notification_titles(client, token) == []


def test_cannot_delete_another_users_notification(client, register_user):
    owner_id, _ = register_user("dono.notifexcluir@example.com")
    _, other_token = register_user("outro.notifexcluir@example.com")

    from app.models.notification import Notification
    from app.models.user import User

    owner = User.objects(id=owner_id).first()
    notif = Notification(recipient=owner, type="request_status", title="Privada").save()

    resp = client.delete(
        f"/notifications/{notif.id}", headers={"Authorization": f"Bearer {other_token}"}
    )
    assert resp.status_code == 404


def test_clear_read_only_deletes_read_notifications(client, register_user):
    user_id, token = register_user("limpar.lidas@example.com")

    from app.models.notification import Notification
    from app.models.user import User
    from app.utils.time import utcnow

    user = User.objects(id=user_id).first()
    Notification(
        recipient=user, type="request_status", title="Lida", read_at=utcnow()
    ).save()
    Notification(recipient=user, type="request_status", title="Não lida").save()

    resp = client.delete(
        "/notifications/read", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["cleared"] == 1
    assert _notification_titles(client, token) == ["Não lida"]
