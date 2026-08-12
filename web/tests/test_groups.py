def _create_group(client, token, **overrides):
    payload = {"name": "Grupo Teste", **overrides}
    resp = client.post(
        "/groups/", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_update_group_as_creator(client, register_user):
    _, creator_token = register_user("creator.groupupdate@example.com")
    group = _create_group(client, creator_token, description="Descrição original")

    resp = client.patch(
        f"/groups/{group['id']}",
        json={"name": "Novo Nome", "description": "Descrição nova"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Novo Nome"
    assert body["description"] == "Descrição nova"


def test_update_group_partial(client, register_user):
    _, creator_token = register_user("creator.grouppartial@example.com")
    group = _create_group(client, creator_token, description="Original")

    resp = client.patch(
        f"/groups/{group['id']}",
        json={"name": "Só o nome mudou"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Só o nome mudou"
    assert body["description"] == "Original"


def test_update_group_rejects_non_creator(client, register_user):
    _, creator_token = register_user("creator.groupreject@example.com")
    group = _create_group(client, creator_token)
    _, member_token = register_user("member.groupreject@example.com")
    client.post(
        "/groups/join",
        json={"invite_code": group["invite_code"]},
        headers={"Authorization": f"Bearer {member_token}"},
    )

    resp = client.patch(
        f"/groups/{group['id']}",
        json={"name": "Tentativa"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 403


def test_update_group_rejects_non_member(client, register_user):
    _, creator_token = register_user("creator.groupnonmember@example.com")
    group = _create_group(client, creator_token)
    _, outsider_token = register_user("outsider.groupnonmember@example.com")

    resp = client.patch(
        f"/groups/{group['id']}",
        json={"name": "Tentativa"},
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert resp.status_code == 404


# --- Co-admins (moderators) ----------------------------------------------


def _join(client, token, invite_code):
    resp = client.post(
        "/groups/join",
        json={"invite_code": invite_code},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _me_id(client, token):
    return client.get("/users/me", headers={"Authorization": f"Bearer {token}"}).json()[
        "id"
    ]


def test_creator_can_appoint_and_revoke_moderator(client, register_user):
    _, creator_token = register_user("creator.modappoint@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.modappoint@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/members/{member_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    member = next(m for m in resp.json()["members"] if m["id"] == member_id)
    assert member["is_moderator"] is True

    resp = client.delete(
        f"/groups/{group['id']}/members/{member_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    member = next(m for m in resp.json()["members"] if m["id"] == member_id)
    assert member["is_moderator"] is False


def test_non_creator_cannot_appoint_moderator(client, register_user):
    _, creator_token = register_user("creator.modreject@example.com")
    group = _create_group(client, creator_token)
    a_id, a_token = register_user("a.modreject@example.com")
    b_id, b_token = register_user("b.modreject@example.com")
    _join(client, a_token, group["invite_code"])
    _join(client, b_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/members/{b_id}/moderator",
        headers={"Authorization": f"Bearer {a_token}"},
    )
    assert resp.status_code == 403


def test_moderator_can_edit_group_and_remove_regular_member(client, register_user):
    _, creator_token = register_user("creator.modpowers@example.com")
    group = _create_group(client, creator_token)
    mod_id, mod_token = register_user("mod.modpowers@example.com")
    target_id, target_token = register_user("target.modpowers@example.com")
    _join(client, mod_token, group["invite_code"])
    _join(client, target_token, group["invite_code"])
    client.post(
        f"/groups/{group['id']}/members/{mod_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    resp = client.patch(
        f"/groups/{group['id']}",
        json={"name": "Editado pelo moderador"},
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Editado pelo moderador"

    resp = client.delete(
        f"/groups/{group['id']}/members/{target_id}",
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert all(m["id"] != target_id for m in resp.json()["members"])


def test_moderator_cannot_remove_another_moderator_or_creator(client, register_user):
    _, creator_token = register_user("creator.modlimits@example.com")
    group = _create_group(client, creator_token)
    creator_id = _me_id(client, creator_token)
    mod1_id, mod1_token = register_user("mod1.modlimits@example.com")
    mod2_id, mod2_token = register_user("mod2.modlimits@example.com")
    _join(client, mod1_token, group["invite_code"])
    _join(client, mod2_token, group["invite_code"])
    for mid in (mod1_id, mod2_id):
        client.post(
            f"/groups/{group['id']}/members/{mid}/moderator",
            headers={"Authorization": f"Bearer {creator_token}"},
        )

    resp = client.delete(
        f"/groups/{group['id']}/members/{mod2_id}",
        headers={"Authorization": f"Bearer {mod1_token}"},
    )
    assert resp.status_code == 403

    resp = client.delete(
        f"/groups/{group['id']}/members/{creator_id}",
        headers={"Authorization": f"Bearer {mod1_token}"},
    )
    assert resp.status_code == 400


def test_leaving_group_clears_moderator_status(client, register_user):
    _, creator_token = register_user("creator.modleave@example.com")
    group = _create_group(client, creator_token)
    mod_id, mod_token = register_user("mod.modleave@example.com")
    _join(client, mod_token, group["invite_code"])
    client.post(
        f"/groups/{group['id']}/members/{mod_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    resp = client.post(
        f"/groups/{group['id']}/leave",
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert resp.status_code == 200, resp.text

    _join(client, mod_token, group["invite_code"])
    resp = client.get(
        f"/groups/{group['id']}",
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    member = next(m for m in resp.json()["members"] if m["id"] == mod_id)
    assert member["is_moderator"] is False


# --- Regenerate invite code -----------------------------------------------


def test_creator_can_regenerate_invite_code(client, register_user):
    _, creator_token = register_user("creator.inviteregen@example.com")
    group = _create_group(client, creator_token)
    old_code = group["invite_code"]

    resp = client.post(
        f"/groups/{group['id']}/invite-code/regenerate",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    new_code = resp.json()["invite_code"]
    assert new_code != old_code

    resp = client.post(
        "/groups/join",
        json={"invite_code": old_code},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 404

    resp = client.post(
        "/groups/join",
        json={"invite_code": new_code},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200


def test_moderator_can_regenerate_invite_code(client, register_user):
    _, creator_token = register_user("creator.inviteregenmod@example.com")
    group = _create_group(client, creator_token)
    mod_id, mod_token = register_user("mod.inviteregenmod@example.com")
    _join(client, mod_token, group["invite_code"])
    client.post(
        f"/groups/{group['id']}/members/{mod_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    resp = client.post(
        f"/groups/{group['id']}/invite-code/regenerate",
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert resp.status_code == 200, resp.text


def test_regular_member_cannot_regenerate_invite_code(client, register_user):
    _, creator_token = register_user("creator.inviteregenreject@example.com")
    group = _create_group(client, creator_token)
    _, member_token = register_user("member.inviteregenreject@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/invite-code/regenerate",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 403
