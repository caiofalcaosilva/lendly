def _make_admin(user_id):
    from app.models.user import User

    User.objects(id=user_id).update(is_admin=True)


def _create_group(client, token, **overrides):
    payload = {"name": "Grupo Teste", **overrides}
    resp = client.post(
        "/groups/", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_report_a_group(client, register_user):
    _, creator_token = register_user("creator.reportgroup@example.com")
    group = _create_group(client, creator_token)
    _, reporter_token = register_user("reporter.reportgroup@example.com")

    resp = client.post(
        "/reports/",
        json={"reported_group_id": group["id"], "reason": "spam"},
        headers={"Authorization": f"Bearer {reporter_token}"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["reported_group_id"] == group["id"]
    assert body["reported_group_name"] == "Grupo Teste"
    assert body["item_id"] is None
    assert body["reported_user_id"] is None


def test_report_requires_exactly_one_target(client, register_user):
    _, creator_token = register_user("creator.reporttargets@example.com")
    group = _create_group(client, creator_token)

    resp = client.post(
        "/reports/",
        json={"reason": "spam"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 422

    resp = client.post(
        "/reports/",
        json={
            "reported_group_id": group["id"],
            "reported_user_id": "x",
            "reason": "spam",
        },
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 422


def test_report_nonexistent_group_404s(client, register_user):
    _, reporter_token = register_user("reporter.reportgroup404@example.com")
    resp = client.post(
        "/reports/",
        json={"reported_group_id": "000000000000000000000000", "reason": "spam"},
        headers={"Authorization": f"Bearer {reporter_token}"},
    )
    assert resp.status_code == 404


def test_admin_can_dismiss_group_report(client, register_user):
    _, creator_token = register_user("creator.reportdismiss@example.com")
    group = _create_group(client, creator_token)
    _, reporter_token = register_user("reporter.reportdismiss@example.com")
    admin_id, admin_token = register_user("admin.reportdismiss@example.com")
    _make_admin(admin_id)

    resp = client.post(
        "/reports/",
        json={"reported_group_id": group["id"], "reason": "spam"},
        headers={"Authorization": f"Bearer {reporter_token}"},
    )
    report_id = resp.json()["id"]

    resp = client.patch(
        f"/reports/{report_id}/dismiss",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "dismissed"

    # Group is untouched.
    resp = client.get(
        f"/groups/{group['id']}",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200


def test_admin_actioning_group_report_deletes_the_group(client, register_user):
    _, creator_token = register_user("creator.reportaction@example.com")
    group = _create_group(client, creator_token)
    _, reporter_token = register_user("reporter.reportaction@example.com")
    admin_id, admin_token = register_user("admin.reportaction@example.com")
    _make_admin(admin_id)

    resp = client.post(
        "/reports/",
        json={"reported_group_id": group["id"], "reason": "spam"},
        headers={"Authorization": f"Bearer {reporter_token}"},
    )
    report_id = resp.json()["id"]

    resp = client.patch(
        f"/reports/{report_id}/action",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "actioned"
    assert body["reported_group_name"] == "Grupo Teste"

    resp = client.get(
        f"/groups/{group['id']}",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 404

    # Listing reports afterward must not 500 on the now-dangling reference.
    resp = client.get("/reports/", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200, resp.text
    listed = next(r for r in resp.json() if r["id"] == report_id)
    assert listed["reported_group_id"] is None
    assert listed["reported_group_name"] is None
