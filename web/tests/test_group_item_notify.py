def _create_group(client, token, **overrides):
    payload = {"name": "Grupo Teste", **overrides}
    resp = client.post(
        "/groups/", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _join(client, token, invite_code):
    resp = client.post(
        "/groups/join",
        json={"invite_code": invite_code},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


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


def test_sharing_item_at_creation_notifies_group_members(client, register_user):
    _, owner_token = register_user("owner.groupitemnotify@example.com")
    group = _create_group(client, owner_token)
    _, member_token = register_user("member.groupitemnotify@example.com")
    _join(client, member_token, group["invite_code"])

    _create_item(
        client, owner_token, title="Furadeira", group_ids=[group["id"]], is_public=False
    )

    resp = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {member_token}"}
    )
    assert resp.status_code == 200, resp.text
    notifs = [n for n in resp.json() if n["type"] == "group_new_item"]
    assert len(notifs) == 1
    assert notifs[0]["title"] == "Furadeira"
    assert notifs[0]["link"]

    resp = client.get(
        "/activities/", headers={"Authorization": f"Bearer {member_token}"}
    )
    assert resp.status_code == 200, resp.text
    activities = [a for a in resp.json() if a["event"] == "group.item_shared"]
    assert len(activities) == 1
    assert activities[0]["resource"]["type"] == "group"
    assert activities[0]["resource"]["id"] == group["id"]
    assert activities[0]["metadata"]["item_title"] == "Furadeira"


def test_owner_is_not_notified_of_their_own_shared_item(client, register_user):
    _, owner_token = register_user("owner.groupitemnoself@example.com")
    group = _create_group(client, owner_token)

    _create_item(client, owner_token, group_ids=[group["id"]], is_public=False)

    resp = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert resp.status_code == 200, resp.text
    assert all(n["type"] != "group_new_item" for n in resp.json())


def test_sharing_item_to_new_group_via_update_notifies_new_group_only(
    client, register_user
):
    _, owner_token = register_user("owner.groupitemupdate@example.com")
    group_a = _create_group(client, owner_token, name="Grupo A")
    group_b = _create_group(client, owner_token, name="Grupo B")
    _, member_a_token = register_user("membera.groupitemupdate@example.com")
    _join(client, member_a_token, group_a["invite_code"])
    _, member_b_token = register_user("memberb.groupitemupdate@example.com")
    _join(client, member_b_token, group_b["invite_code"])

    item = _create_item(client, owner_token, group_ids=[group_a["id"]], is_public=False)

    resp = client.put(
        f"/items/{item['id']}",
        json={"group_ids": [group_a["id"], group_b["id"]]},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 200, resp.text

    resp = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {member_a_token}"}
    )
    assert len([n for n in resp.json() if n["type"] == "group_new_item"]) == 1

    resp = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {member_b_token}"}
    )
    assert len([n for n in resp.json() if n["type"] == "group_new_item"]) == 1


def test_disabling_group_new_item_prefs_suppresses_notification(client, register_user):
    _, owner_token = register_user("owner.groupitemprefs@example.com")
    group = _create_group(client, owner_token)
    _, member_token = register_user("member.groupitemprefs@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.put(
        "/notifications/preferences",
        json={"group_new_item": False},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200, resp.text

    _create_item(client, owner_token, group_ids=[group["id"]], is_public=False)

    resp = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {member_token}"}
    )
    assert all(n["type"] != "group_new_item" for n in resp.json())
