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


# Campo Grande, Recife — used as the "home address" origin in these tests.
HOME_LAT, HOME_LNG = -8.0397, -34.9022
# ~2km from HOME.
NEAR_LAT, NEAR_LNG = -8.05, -34.90
# ~100km south of HOME — well past the 50km default cap from home alone.
FAR_LAT, FAR_LNG = -8.9397, -34.9022


def test_no_location_at_all_applies_no_distance_cap(client, register_user):
    _, owner_token = register_user("dono.semlocal@example.com")
    near = _create_item(
        client, owner_token, title="Item perto", latitude=NEAR_LAT, longitude=NEAR_LNG
    )
    far = _create_item(
        client, owner_token, title="Item longe", latitude=FAR_LAT, longitude=FAR_LNG
    )

    resp = client.get("/items/")
    assert resp.status_code == 200
    ids = {i["id"] for i in resp.json()}
    assert near["id"] in ids
    assert far["id"] in ids


def test_default_50km_cap_applies_without_explicit_radius(client, register_user):
    _, owner_token = register_user("dono.tetopadrao@example.com")
    near = _create_item(
        client, owner_token, title="Item perto", latitude=NEAR_LAT, longitude=NEAR_LNG
    )
    far = _create_item(
        client, owner_token, title="Item longe", latitude=FAR_LAT, longitude=FAR_LNG
    )

    resp = client.get("/items/", params={"lat": HOME_LAT, "lng": HOME_LNG})
    assert resp.status_code == 200
    ids = {i["id"] for i in resp.json()}
    assert near["id"] in ids
    assert far["id"] not in ids


def test_second_origin_is_union_not_intersection(client, register_user):
    """An item too far from 'home' still shows up if it's near the
    visitor's live location — the two radii combine with OR, not AND."""
    _, owner_token = register_user("dono.uniao@example.com")
    far = _create_item(
        client, owner_token, title="Item longe", latitude=FAR_LAT, longitude=FAR_LNG
    )

    resp = client.get(
        "/items/",
        params={"lat": HOME_LAT, "lng": HOME_LNG, "lat2": FAR_LAT, "lng2": FAR_LNG},
    )
    assert resp.status_code == 200
    ids = {i["id"] for i in resp.json()}
    assert far["id"] in ids


def test_explicit_radius_overrides_default_cap(client, register_user):
    _, owner_token = register_user("dono.raioexplicito@example.com")
    near = _create_item(
        client, owner_token, title="Item perto", latitude=NEAR_LAT, longitude=NEAR_LNG
    )

    resp = client.get(
        "/items/", params={"lat": HOME_LAT, "lng": HOME_LNG, "radius_km": 1}
    )
    assert resp.status_code == 200
    ids = {i["id"] for i in resp.json()}
    assert near["id"] not in ids
