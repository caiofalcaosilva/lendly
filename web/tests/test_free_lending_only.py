from app.config import settings


def _item_payload(**overrides):
    return {
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


def test_free_lending_only_blocks_paid_item_creation(
    client, register_user, monkeypatch
):
    monkeypatch.setattr(settings, "FREE_LENDING_ONLY", True)
    _, token = register_user("dono.freelending@example.com")

    resp = client.post(
        "/items/",
        json=_item_payload(availability_type="paid", daily_rate=50.0),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400, resp.text
    assert "gratuito" in resp.json()["detail"]


def test_free_lending_only_blocks_paid_item_update(client, register_user, monkeypatch):
    _, token = register_user("dono.freelendingupdate@example.com")

    resp = client.post(
        "/items/", json=_item_payload(), headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201, resp.text
    item_id = resp.json()["id"]

    monkeypatch.setattr(settings, "FREE_LENDING_ONLY", True)
    resp = client.put(
        f"/items/{item_id}",
        json={"availability_type": "paid", "daily_rate": 50.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400, resp.text
    assert "gratuito" in resp.json()["detail"]


def test_free_lending_only_off_allows_paid_item(client, register_user):
    from app.models.user import User

    user_id, token = register_user("dono.pagopermitido@example.com")
    User.objects(id=user_id).update(set__mp_connection__mp_user_id="MP-TEST-123")

    resp = client.post(
        "/items/",
        json=_item_payload(availability_type="paid", daily_rate=50.0),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["availability_type"] == "paid"


def test_public_config_reports_free_lending_only(client, monkeypatch):
    monkeypatch.setattr(settings, "FREE_LENDING_ONLY", True)
    resp = client.get("/config")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"free_lending_only": True}

    monkeypatch.setattr(settings, "FREE_LENDING_ONLY", False)
    resp = client.get("/config")
    assert resp.json() == {"free_lending_only": False}
