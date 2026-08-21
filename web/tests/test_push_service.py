from unittest.mock import MagicMock

from pywebpush import WebPushException

from app.config import settings
from app.models.user import PushSubscription, User
from app.services import push_service


def _make_user(email: str) -> User:
    user = User(
        name="Push Test",
        email=email,
        password_hash="x",
        push_subscriptions=[
            PushSubscription(endpoint="https://push.example/a", p256dh="p1", auth="a1"),
            PushSubscription(endpoint="https://push.example/b", p256dh="p2", auth="a2"),
        ],
    )
    user.save()
    return user


def test_send_push_noop_without_vapid_key(monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "")
    user = _make_user("push-noop@example.com")
    called = MagicMock()
    monkeypatch.setattr(push_service, "webpush", called)

    push_service.send_push(user, "Title", "Body", "/link")

    called.assert_not_called()
    user.delete()


def test_send_push_calls_webpush_per_subscription(monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "priv-key")
    user = _make_user("push-send@example.com")
    called = MagicMock()
    monkeypatch.setattr(push_service, "webpush", called)

    push_service.send_push(user, "Title", "Body", "/link")

    assert called.call_count == 2
    user.reload()
    assert len(user.push_subscriptions) == 2
    user.delete()


def test_send_push_prunes_gone_subscription(monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "priv-key")
    user = _make_user("push-prune@example.com")

    def fake_webpush(subscription_info, **kwargs):
        if subscription_info["endpoint"].endswith("/a"):
            response = MagicMock(status_code=410)
            raise WebPushException("gone", response=response)

    monkeypatch.setattr(push_service, "webpush", fake_webpush)

    push_service.send_push(user, "Title", "Body", "/link")

    user.reload()
    endpoints = [s.endpoint for s in user.push_subscriptions]
    assert endpoints == ["https://push.example/b"]
    user.delete()


def test_send_push_keeps_subscription_on_other_errors(monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "priv-key")
    user = _make_user("push-keep@example.com")

    def fake_webpush(subscription_info, **kwargs):
        response = MagicMock(status_code=500)
        raise WebPushException("server error", response=response)

    monkeypatch.setattr(push_service, "webpush", fake_webpush)

    push_service.send_push(user, "Title", "Body", "/link")

    user.reload()
    assert len(user.push_subscriptions) == 2
    user.delete()
