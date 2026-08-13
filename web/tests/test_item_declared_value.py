from app.models.user import User


def _create_item(client, token, **overrides):
    payload = {
        "title": "Furadeira",
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


def test_declared_value_saved_and_visible_to_owner(client, register_user):
    _, owner_token = register_user("dono.valor@example.com")
    item = _create_item(client, owner_token, declared_value=800.0)
    assert item["declared_value"] == 800.0

    fetched = client.get(
        f"/items/{item['id']}", headers={"Authorization": f"Bearer {owner_token}"}
    ).json()
    assert fetched["declared_value"] == 800.0


def test_declared_value_hidden_from_anonymous_visitor(client, register_user):
    _, owner_token = register_user("dono.valoranon@example.com")
    item = _create_item(client, owner_token, declared_value=800.0)

    anon = client.get(f"/items/{item['id']}")
    assert anon.status_code == 200
    assert anon.json()["declared_value"] is None


def test_declared_value_hidden_from_other_logged_in_user(client, register_user):
    _, owner_token = register_user("dono.valoroutro@example.com")
    item = _create_item(client, owner_token, declared_value=800.0)
    _, other_token = register_user("outro.valor@example.com")

    fetched = client.get(
        f"/items/{item['id']}", headers={"Authorization": f"Bearer {other_token}"}
    ).json()
    assert fetched["declared_value"] is None


def test_declared_value_visible_to_admin(client, register_user):
    _, owner_token = register_user("dono.valoradmin@example.com")
    item = _create_item(client, owner_token, declared_value=800.0)
    admin_id, admin_token = register_user("admin.valor@example.com")
    User.objects(id=admin_id).update(is_admin=True)

    fetched = client.get(
        f"/items/{item['id']}", headers={"Authorization": f"Bearer {admin_token}"}
    ).json()
    assert fetched["declared_value"] == 800.0


def test_declared_value_hidden_in_public_listing(client, register_user):
    _, owner_token = register_user("dono.valorlista@example.com")
    created = _create_item(client, owner_token, declared_value=800.0)

    # Plain unfiltered listing — avoids the $text-search path entirely
    # (search= exercises a MongoDB text index this test suite's per-test
    # collection-drop fixture doesn't reliably keep around).
    listing = client.get("/items", params={"limit": 100})
    assert listing.status_code == 200
    matches = [i for i in listing.json() if i["id"] == created["id"]]
    assert len(matches) == 1
    assert matches[0]["declared_value"] is None
