import os

# Must happen before anything under app/ is imported — app.config.Settings()
# reads MONGODB_DB from the environment at import time, and every test in
# this suite depends on that resolving to a disposable database, never the
# real "lendly" one a developer might have running locally.
os.environ["MONGODB_DB"] = "lendly_test"

# app.main's startup check (assert_secrets_configured) fails loudly if
# SECRET_KEY/ENCRYPTION_KEY are still their placeholder values — true by
# default in CI, which has no .env file. Tests don't care what the actual
# values are, just that they're not the placeholder, so a fixed test-only
# key is fine here (ENCRYPTION_KEY still needs a valid Fernet format in
# case a test ever exercises app.utils.crypto).
from cryptography.fernet import Fernet  # noqa: E402

os.environ.setdefault("SECRET_KEY", "pytest-test-secret-key-not-for-production")
os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())

import mongoengine
import pytest


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app
    from app.rate_limit import limiter

    limiter.enabled = False
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _clean_db(client):
    yield
    db = mongoengine.connection.get_db()
    for name in db.list_collection_names():
        db.drop_collection(name)


@pytest.fixture
def register_user(client):
    """Registers a user via the real API, then flips is_verified directly in
    the DB (skipping the email-link step) and logs in. Returns a callable
    (email, **overrides) -> (user_id, access_token)."""

    def _register(email: str, **overrides) -> tuple[str, str]:
        from app.models.activity import Activity
        from app.models.notification import Notification
        from app.models.user import User

        password = overrides.pop("password", "SenhaForte123!")
        payload = {
            "name": "Test User",
            "email": email,
            "password": password,
            "account_type": "individual",
            **overrides,
        }
        resp = client.post("/auth/register", json=payload)
        assert resp.status_code == 201, resp.text
        user_id = resp.json()["user"]["id"]
        User.objects(id=user_id).update(is_verified=True)

        login = client.post("/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200, login.text
        # This login is fixture plumbing, not something under test — it
        # fires a real "new_login" notification/activity (untoggleable
        # security category) that would otherwise pollute every
        # notification-count/activity-list assertion in every test that
        # uses this fixture.
        Notification.objects(recipient=user_id).delete()
        Activity.objects(recipient=user_id).delete()
        return user_id, login.json()["access_token"]

    return _register
