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


def test_get_group_reports_viewer_membership(client, register_user):
    _, creator_token = register_user("creator.viewerflags@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.viewerflags@example.com")
    _join(client, member_token, group["invite_code"])
    client.post(
        f"/groups/{group['id']}/members/{member_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    admin_id, admin_token = register_user("admin.viewerflags@example.com")
    _make_admin(admin_id)

    resp = client.get(
        f"/groups/{group['id']}", headers={"Authorization": f"Bearer {creator_token}"}
    )
    assert resp.json()["is_viewer_member"] is True
    assert resp.json()["is_viewer_moderator"] is False

    resp = client.get(
        f"/groups/{group['id']}", headers={"Authorization": f"Bearer {member_token}"}
    )
    assert resp.json()["is_viewer_member"] is True
    assert resp.json()["is_viewer_moderator"] is True

    resp = client.get(
        f"/groups/{group['id']}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.json()["is_viewer_member"] is False
    assert resp.json()["is_viewer_moderator"] is False


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


def _members(client, token, group_id, **params):
    resp = client.get(
        f"/groups/{group_id}/members",
        params=params,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


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
    assert resp.json()["id"] == member_id
    assert resp.json()["is_moderator"] is True

    resp = client.delete(
        f"/groups/{group['id']}/members/{member_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == member_id
    assert resp.json()["is_moderator"] is False


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
    assert resp.json()["member_count"] == 2
    assert all(m["id"] != target_id for m in _members(client, mod_token, group["id"]))


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
    member = next(
        m for m in _members(client, mod_token, group["id"]) if m["id"] == mod_id
    )
    assert member["is_moderator"] is False


# --- Paginated member list ---------------------------------------------------


def test_members_endpoint_paginates_alphabetically(client, register_user):
    _, creator_token = register_user(
        "creator.memberspage@example.com", name="Zeca Criador"
    )
    group = _create_group(client, creator_token)
    for name in ("Bruno Membro", "Ana Membro"):
        _, token = register_user(
            f"{name.lower().replace(' ', '.')}@example.com", name=name
        )
        _join(client, token, group["invite_code"])

    page1 = _members(client, creator_token, group["id"], limit=2)
    assert [m["name"] for m in page1] == ["Ana Membro", "Bruno Membro"]

    page2 = _members(client, creator_token, group["id"], limit=2, skip=2)
    assert [m["name"] for m in page2] == ["Zeca Criador"]


def test_members_endpoint_filters_by_search(client, register_user):
    _, creator_token = register_user("creator.memberssearch@example.com")
    group = _create_group(client, creator_token)
    _, token = register_user("bruno.memberssearch@example.com", name="Bruno Vizinho")
    _join(client, token, group["invite_code"])

    results = _members(client, creator_token, group["id"], search="vizinho")
    assert [m["name"] for m in results] == ["Bruno Vizinho"]


def test_members_endpoint_rejects_non_members(client, register_user):
    _, creator_token = register_user("creator.membersreject@example.com")
    group = _create_group(client, creator_token)
    _, outsider_token = register_user("outsider.membersreject@example.com")

    resp = client.get(
        f"/groups/{group['id']}/members",
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert resp.status_code == 404


def test_members_endpoint_allows_admin_read(client, register_user):
    _, creator_token = register_user("creator.membersadmin@example.com")
    group = _create_group(client, creator_token)
    admin_id, admin_token = register_user("admin.membersadmin@example.com")
    _make_admin(admin_id)

    results = _members(client, admin_token, group["id"])
    assert len(results) == 1


# --- Paginated group items ---------------------------------------------------


def _group_items(client, token, group_id, **params):
    resp = client.get(
        f"/groups/{group_id}/items",
        params=params,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_group_items_paginates_newest_first(client, register_user):
    _, creator_token = register_user("creator.itemspage@example.com")
    group = _create_group(client, creator_token)
    for title in ("Item A", "Item B", "Item C"):
        _create_item(
            client, creator_token, title=title, group_ids=[group["id"]], is_public=False
        )

    page1 = _group_items(client, creator_token, group["id"], limit=2)
    assert [i["title"] for i in page1] == ["Item C", "Item B"]

    page2 = _group_items(client, creator_token, group["id"], limit=2, skip=2)
    assert [i["title"] for i in page2] == ["Item A"]


def test_group_items_rejects_non_members(client, register_user):
    _, creator_token = register_user("creator.itemsreject@example.com")
    group = _create_group(client, creator_token)
    _create_item(client, creator_token, group_ids=[group["id"]], is_public=False)
    _, outsider_token = register_user("outsider.itemsreject@example.com")

    resp = client.get(
        f"/groups/{group['id']}/items",
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert resp.status_code == 404


# --- "My groups" search and pagination ---------------------------------------


def test_my_groups_filters_by_search(client, register_user):
    _, token = register_user("creator.mygroupssearch@example.com")
    _create_group(client, token, name="Condomínio Jardins")
    _create_group(client, token, name="Rua das Flores")

    resp = client.get(
        "/groups/me?search=jardins", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, resp.text
    assert [g["name"] for g in resp.json()] == ["Condomínio Jardins"]


def test_my_groups_paginates_alphabetically(client, register_user):
    _, token = register_user("creator.mygroupspage@example.com")
    for name in ("Grupo C", "Grupo A", "Grupo B"):
        _create_group(client, token, name=name)

    page1 = client.get(
        "/groups/me?limit=2", headers={"Authorization": f"Bearer {token}"}
    ).json()
    assert [g["name"] for g in page1] == ["Grupo A", "Grupo B"]

    page2 = client.get(
        "/groups/me?limit=2&skip=2", headers={"Authorization": f"Bearer {token}"}
    ).json()
    assert [g["name"] for g in page2] == ["Grupo C"]


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


def test_discover_paginates_closest_first(client, register_user):
    # Three creators at increasing offsets from the visitor's origin, each
    # with one discoverable group - lets us assert both the ordering
    # (closest first) and that skip/limit slice it correctly.
    names_and_offsets = [("Grupo 1km", 0.01), ("Grupo 2km", 0.02), ("Grupo 3km", 0.03)]
    for name, offset in names_and_offsets:
        _, token = register_user(
            f"creator.{name.replace(' ', '')}@example.com",
            latitude=SP_LAT + offset,
            longitude=SP_LNG,
        )
        group = _create_group(client, token, name=name)
        client.patch(
            f"/groups/{group['id']}",
            json={"is_discoverable": True},
            headers={"Authorization": f"Bearer {token}"},
        )

    _, visitor_token = register_user(
        "visitor.discoverpage@example.com", latitude=SP_LAT, longitude=SP_LNG
    )

    page1 = client.get(
        f"/groups/discover?lat={SP_LAT}&lng={SP_LNG}&limit=2",
        headers={"Authorization": f"Bearer {visitor_token}"},
    ).json()
    assert [g["name"] for g in page1] == ["Grupo 1km", "Grupo 2km"]

    page2 = client.get(
        f"/groups/discover?lat={SP_LAT}&lng={SP_LNG}&limit=2&skip=2",
        headers={"Authorization": f"Bearer {visitor_token}"},
    ).json()
    assert [g["name"] for g in page2] == ["Grupo 3km"]


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
    assert resp.json()["member_count"] == 2
    assert any(
        m["name"] == "Test User" for m in _members(client, visitor_token, group["id"])
    )


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
    creator_id, creator_token = register_user("creator.vouchnote@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.vouchnote@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/members/{member_id}/vouch",
        json={"note": "Vizinho de prédio"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    member = resp.json()
    assert member["id"] == member_id
    assert len(member["vouchers"]) == 1
    assert member["vouchers"][0]["id"] == creator_id
    assert member["vouchers"][0]["note"] == "Vizinho de prédio"


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
    member = resp.json()
    assert member["id"] == member_id
    assert member["vouch_count"] == 1
    assert member["vouchers"][0]["note"] is None


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
    member = resp.json()
    assert member["id"] == member_id
    assert member["vouch_count"] == 1
    assert [v["note"] for v in member["vouchers"]] == ["Vizinho de prédio"]


# --- group_membership_changed notifications --------------------------------


def _notif_types(client, token):
    resp = client.get("/notifications/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    return [n["type"] for n in resp.json()]


def test_promoting_to_moderator_notifies_target(client, register_user):
    _, creator_token = register_user("creator.notifmodadd@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.notifmodadd@example.com")
    _join(client, member_token, group["invite_code"])

    client.post(
        f"/groups/{group['id']}/members/{member_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert "group_membership_changed" in _notif_types(client, member_token)


def test_revoking_moderator_notifies_target(client, register_user):
    _, creator_token = register_user("creator.notifmodremove@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.notifmodremove@example.com")
    _join(client, member_token, group["invite_code"])
    client.post(
        f"/groups/{group['id']}/members/{member_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    client.delete(
        f"/groups/{group['id']}/members/{member_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert _notif_types(client, member_token).count("group_membership_changed") == 2


def test_removing_member_notifies_target(client, register_user):
    _, creator_token = register_user("creator.notifremove@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.notifremove@example.com")
    _join(client, member_token, group["invite_code"])

    client.delete(
        f"/groups/{group['id']}/members/{member_id}",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert "group_membership_changed" in _notif_types(client, member_token)


def test_deleting_group_notifies_members_but_not_the_deleter(client, register_user):
    _, creator_token = register_user("creator.notifdelete@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.notifdelete@example.com")
    _join(client, member_token, group["invite_code"])

    client.delete(
        f"/groups/{group['id']}",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert "group_membership_changed" in _notif_types(client, member_token)
    assert "group_membership_changed" not in _notif_types(client, creator_token)


def test_disabling_group_membership_prefs_suppresses_notification(
    client, register_user
):
    _, creator_token = register_user("creator.notifprefs@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.notifprefs@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.put(
        "/notifications/preferences",
        json={"group_membership_changed": False},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200, resp.text

    client.post(
        f"/groups/{group['id']}/members/{member_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert "group_membership_changed" not in _notif_types(client, member_token)


# --- Admin group listing: search + pagination + extra fields ---------------


def _make_admin(user_id):
    from app.models.user import User

    User.objects(id=user_id).update(is_admin=True)


def test_admin_list_groups_includes_creator_name_and_discoverable(
    client, register_user
):
    _, creator_token = register_user(
        "creator.adminlistfields@example.com", latitude=-23.5505, longitude=-46.6333
    )
    group = _create_group(client, creator_token, name="Grupo Admin List")
    client.patch(
        f"/groups/{group['id']}",
        json={"is_discoverable": True},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    admin_id, admin_token = register_user("admin.adminlistfields@example.com")
    _make_admin(admin_id)

    resp = client.get(
        "/admin/groups", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200, resp.text
    listed = next(g for g in resp.json() if g["id"] == group["id"])
    assert listed["created_by_name"] == "Test User"
    assert listed["is_discoverable"] is True
    assert "created_at" in listed


def test_admin_list_groups_filters_by_search(client, register_user):
    _, creator_token = register_user("creator.adminlistsearch@example.com")
    _create_group(client, creator_token, name="Condomínio Jardins")
    _create_group(client, creator_token, name="Rua das Flores")
    admin_id, admin_token = register_user("admin.adminlistsearch@example.com")
    _make_admin(admin_id)

    resp = client.get(
        "/admin/groups?search=jardins",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    names = [g["name"] for g in resp.json()]
    assert names == ["Condomínio Jardins"]


def test_admin_list_groups_paginates(client, register_user):
    _, creator_token = register_user("creator.adminlistpage@example.com")
    for i in range(3):
        _create_group(client, creator_token, name=f"Grupo Página {i}")
    admin_id, admin_token = register_user("admin.adminlistpage@example.com")
    _make_admin(admin_id)

    resp = client.get(
        "/admin/groups?limit=2", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 2

    resp = client.get(
        "/admin/groups?limit=2&skip=2",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1


# --- Ownership transfer ------------------------------------------------------


def test_creator_can_transfer_ownership(client, register_user):
    _, creator_token = register_user("creator.transfer@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.transfer@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/transfer-ownership",
        json={"new_creator_id": member_id},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["created_by"] == member_id

    # Old creator can now leave (they're a regular member) — previously
    # they couldn't.
    resp = client.post(
        f"/groups/{group['id']}/leave",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text

    # New creator can now delete the group — old creator couldn't anymore.
    resp = client.delete(
        f"/groups/{group['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 204


def test_transferring_to_a_moderator_clears_their_moderator_status(
    client, register_user
):
    _, creator_token = register_user("creator.transfermod@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.transfermod@example.com")
    _join(client, member_token, group["invite_code"])
    client.post(
        f"/groups/{group['id']}/members/{member_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    resp = client.post(
        f"/groups/{group['id']}/transfer-ownership",
        json={"new_creator_id": member_id},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["created_by"] == member_id
    new_creator_row = next(
        m for m in _members(client, member_token, group["id"]) if m["id"] == member_id
    )
    assert new_creator_row["is_moderator"] is False


def test_only_creator_can_transfer_ownership(client, register_user):
    _, creator_token = register_user("creator.transferreject@example.com")
    group = _create_group(client, creator_token)
    a_id, a_token = register_user("a.transferreject@example.com")
    b_id, b_token = register_user("b.transferreject@example.com")
    _join(client, a_token, group["invite_code"])
    _join(client, b_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/transfer-ownership",
        json={"new_creator_id": b_id},
        headers={"Authorization": f"Bearer {a_token}"},
    )
    assert resp.status_code == 403


def test_cannot_transfer_ownership_to_a_non_member(client, register_user):
    _, creator_token = register_user("creator.transfernonmember@example.com")
    group = _create_group(client, creator_token)
    outsider_id, _ = register_user("outsider.transfernonmember@example.com")

    resp = client.post(
        f"/groups/{group['id']}/transfer-ownership",
        json={"new_creator_id": outsider_id},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 404


def test_cannot_transfer_ownership_to_self(client, register_user):
    _, creator_token = register_user("creator.transferself@example.com")
    group = _create_group(client, creator_token)
    creator_id = _me_id(client, creator_token)

    resp = client.post(
        f"/groups/{group['id']}/transfer-ownership",
        json={"new_creator_id": creator_id},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 400


def test_transferring_ownership_notifies_new_creator(client, register_user):
    _, creator_token = register_user("creator.transfernotif@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.transfernotif@example.com")
    _join(client, member_token, group["invite_code"])

    client.post(
        f"/groups/{group['id']}/transfer-ownership",
        json={"new_creator_id": member_id},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert "group_membership_changed" in _notif_types(client, member_token)


# --- Refresh location --------------------------------------------------------


def test_refresh_location_syncs_from_creators_current_address(client, register_user):
    _, creator_token = register_user(
        "creator.refreshlocation@example.com", latitude=SP_LAT, longitude=SP_LNG
    )
    group = _create_group(client, creator_token)

    # Creator moves.
    client.put(
        "/users/me",
        json={
            "latitude": SP_NEARBY_LAT,
            "longitude": SP_NEARBY_LNG,
            "city": "Nova Cidade",
        },
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    resp = client.post(
        f"/groups/{group['id']}/refresh-location",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["city"] == "Nova Cidade"


def test_moderator_can_refresh_location(client, register_user):
    _, creator_token = register_user(
        "creator.refreshlocationmod@example.com", latitude=SP_LAT, longitude=SP_LNG
    )
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.refreshlocationmod@example.com")
    _join(client, member_token, group["invite_code"])
    client.post(
        f"/groups/{group['id']}/members/{member_id}/moderator",
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    resp = client.post(
        f"/groups/{group['id']}/refresh-location",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200, resp.text


def test_regular_member_cannot_refresh_location(client, register_user):
    _, creator_token = register_user("creator.refreshlocationreject@example.com")
    group = _create_group(client, creator_token)
    _, member_token = register_user("member.refreshlocationreject@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/refresh-location",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 403
