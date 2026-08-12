import io

from PIL import Image


def _fake_photo():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color="red").save(buf, "PNG")
    buf.seek(0)
    return ("photo.png", buf, "image/png")


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


# --- Group photo -----------------------------------------------------------


def test_creator_can_upload_and_remove_group_photo(client, register_user):
    _, creator_token = register_user("creator.groupphoto@example.com")
    group = _create_group(client, creator_token)

    resp = client.post(
        f"/groups/{group['id']}/photo",
        files={"file": _fake_photo()},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["photo_url"]

    resp = client.delete(
        f"/groups/{group['id']}/photo",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["photo_url"] is None


def test_moderator_can_upload_group_photo(client, register_user):
    _, creator_token = register_user("creator.groupphotomod@example.com")
    group = _create_group(client, creator_token)
    mod_id, mod_token = register_user("mod.groupphotomod@example.com")
    _join(client, mod_token, group["invite_code"])
    client.post(
        f"/groups/{group['id']}/members/{mod_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    resp = client.post(
        f"/groups/{group['id']}/photo",
        files={"file": _fake_photo()},
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert resp.status_code == 201, resp.text


def test_regular_member_cannot_upload_group_photo(client, register_user):
    _, creator_token = register_user("creator.groupphotoreject@example.com")
    group = _create_group(client, creator_token)
    _, member_token = register_user("member.groupphotoreject@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/photo",
        files={"file": _fake_photo()},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 403


# --- Discovery ("grupos perto de você") -------------------------------------

# São Paulo (creator) and a point ~1km away (nearby visitor) vs. Rio (far
# visitor, ~360km from São Paulo).
SP_LAT, SP_LNG = -23.5505, -46.6333
SP_NEARBY_LAT, SP_NEARBY_LNG = -23.5599, -46.6333
RIO_LAT, RIO_LNG = -22.9068, -43.1729


def test_creator_can_make_group_discoverable(client, register_user):
    _, creator_token = register_user(
        "creator.discoverable@example.com", latitude=SP_LAT, longitude=SP_LNG
    )
    group = _create_group(client, creator_token)

    resp = client.patch(
        f"/groups/{group['id']}",
        json={"is_discoverable": True},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_discoverable"] is True


def test_cannot_make_group_discoverable_without_creator_location(client, register_user):
    _, creator_token = register_user("creator.discoverablenoloc@example.com")
    group = _create_group(client, creator_token)

    resp = client.patch(
        f"/groups/{group['id']}",
        json={"is_discoverable": True},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 400


def test_discover_returns_nearby_discoverable_groups_only(client, register_user):
    _, creator_token = register_user(
        "creator.discoverfeed@example.com", latitude=SP_LAT, longitude=SP_LNG
    )
    nearby_group = _create_group(client, creator_token, name="Grupo Pertinho")
    client.patch(
        f"/groups/{nearby_group['id']}",
        json={"is_discoverable": True},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    # A second group by the same creator, never made discoverable.
    _create_group(client, creator_token, name="Grupo Privado")

    _, visitor_token = register_user(
        "visitor.discoverfeed@example.com",
        latitude=SP_NEARBY_LAT,
        longitude=SP_NEARBY_LNG,
    )
    resp = client.get(
        f"/groups/discover?lat={SP_NEARBY_LAT}&lng={SP_NEARBY_LNG}",
        headers={"Authorization": f"Bearer {visitor_token}"},
    )
    assert resp.status_code == 200, resp.text
    names = [g["name"] for g in resp.json()]
    assert names == ["Grupo Pertinho"]
    assert resp.json()[0]["distance_km"] < 5


def test_discover_excludes_far_and_own_groups(client, register_user):
    _, creator_token = register_user(
        "creator.discoverfar@example.com", latitude=SP_LAT, longitude=SP_LNG
    )
    group = _create_group(client, creator_token)
    client.patch(
        f"/groups/{group['id']}",
        json={"is_discoverable": True},
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    resp = client.get(
        f"/groups/discover?lat={SP_LAT}&lng={SP_LNG}",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == []

    _, far_token = register_user(
        "visitor.discoverfar@example.com", latitude=RIO_LAT, longitude=RIO_LNG
    )
    resp = client.get(
        f"/groups/discover?lat={RIO_LAT}&lng={RIO_LNG}",
        headers={"Authorization": f"Bearer {far_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_discover_without_origin_returns_empty(client, register_user):
    _, token = register_user("visitor.discovernoorigin@example.com")
    resp = client.get("/groups/discover", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_join_discoverable_group(client, register_user):
    _, creator_token = register_user(
        "creator.joindiscoverable@example.com", latitude=SP_LAT, longitude=SP_LNG
    )
    group = _create_group(client, creator_token)
    client.patch(
        f"/groups/{group['id']}",
        json={"is_discoverable": True},
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    _, visitor_token = register_user("visitor.joindiscoverable@example.com")
    resp = client.post(
        f"/groups/{group['id']}/join",
        headers={"Authorization": f"Bearer {visitor_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert any(m["name"] == "Test User" for m in resp.json()["members"])


def test_cannot_join_non_discoverable_group_directly(client, register_user):
    _, creator_token = register_user("creator.joinreject@example.com")
    group = _create_group(client, creator_token)

    _, visitor_token = register_user("visitor.joinreject@example.com")
    resp = client.post(
        f"/groups/{group['id']}/join",
        headers={"Authorization": f"Bearer {visitor_token}"},
    )
    assert resp.status_code == 404


# --- Vouch note --------------------------------------------------------------


def test_vouch_with_note_is_visible_on_member(client, register_user):
    _, creator_token = register_user("creator.vouchnote@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.vouchnote@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/members/{member_id}/vouch",
        json={"note": "Vizinho de prédio"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    member = next(m for m in resp.json()["members"] if m["id"] == member_id)
    assert member["vouch_notes"] == ["Vizinho de prédio"]


def test_vouch_without_body_still_works(client, register_user):
    _, creator_token = register_user("creator.vouchnobody@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.vouchnobody@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/members/{member_id}/vouch",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    member = next(m for m in resp.json()["members"] if m["id"] == member_id)
    assert member["vouch_count"] == 1
    assert member["vouch_notes"] == []


def test_revouching_does_not_overwrite_existing_note(client, register_user):
    _, creator_token = register_user("creator.vouchreidempotent@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.vouchreidempotent@example.com")
    _join(client, member_token, group["invite_code"])

    client.post(
        f"/groups/{group['id']}/members/{member_id}/vouch",
        json={"note": "Vizinho de prédio"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    resp = client.post(
        f"/groups/{group['id']}/members/{member_id}/vouch",
        json={"note": "Colega de trabalho"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    member = next(m for m in resp.json()["members"] if m["id"] == member_id)
    assert member["vouch_count"] == 1
    assert member["vouch_notes"] == ["Vizinho de prédio"]
