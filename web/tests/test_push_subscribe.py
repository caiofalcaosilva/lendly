from app.models.user import User


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_push_subscribe_adds_subscription(client, register_user):
    user_id, token = register_user("push.subscribe@example.com")

    resp = client.post(
        "/notifications/push-subscribe",
        json={
            "endpoint": "https://push.example/dev-a",
            "keys": {"p256dh": "p1", "auth": "a1"},
        },
        headers=_headers(token),
    )
    assert resp.status_code == 204, resp.text

    user = User.objects(id=user_id).first()
    assert len(user.push_subscriptions) == 1
    assert user.push_subscriptions[0].endpoint == "https://push.example/dev-a"


def test_push_subscribe_same_endpoint_does_not_duplicate(client, register_user):
    user_id, token = register_user("push.resubscribe@example.com")

    for keys in ({"p256dh": "p1", "auth": "a1"}, {"p256dh": "p2", "auth": "a2"}):
        resp = client.post(
            "/notifications/push-subscribe",
            json={"endpoint": "https://push.example/dev-a", "keys": keys},
            headers=_headers(token),
        )
        assert resp.status_code == 204, resp.text

    user = User.objects(id=user_id).first()
    assert len(user.push_subscriptions) == 1
    assert user.push_subscriptions[0].p256dh == "p2"


def test_push_unsubscribe_removes_subscription(client, register_user):
    user_id, token = register_user("push.unsubscribe@example.com")
    client.post(
        "/notifications/push-subscribe",
        json={
            "endpoint": "https://push.example/dev-a",
            "keys": {"p256dh": "p1", "auth": "a1"},
        },
        headers=_headers(token),
    )

    resp = client.post(
        "/notifications/push-unsubscribe",
        json={"endpoint": "https://push.example/dev-a"},
        headers=_headers(token),
    )
    assert resp.status_code == 204, resp.text

    user = User.objects(id=user_id).first()
    assert user.push_subscriptions == []
