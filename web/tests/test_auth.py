def test_register_creates_unverified_user(client):
    resp = client.post(
        "/auth/register",
        json={
            "name": "Ana Teste",
            "email": "ana.register@example.com",
            "password": "SenhaForte123!",
            "accepted_terms": True,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["is_verified"] is False
    assert body["user"]["email"] == "ana.register@example.com"


def test_register_duplicate_email_returns_409(client):
    payload = {
        "name": "Ana Teste",
        "email": "ana.duplicada@example.com",
        "password": "SenhaForte123!",
        "accepted_terms": True,
    }
    first = client.post("/auth/register", json=payload)
    assert first.status_code == 201
    second = client.post("/auth/register", json=payload)
    assert second.status_code == 409


def test_register_short_password_returns_422(client):
    resp = client.post(
        "/auth/register",
        json={"name": "Ana", "email": "ana.senha@example.com", "password": "123"},
    )
    assert resp.status_code == 422


def test_register_without_accepting_terms_returns_422(client):
    resp = client.post(
        "/auth/register",
        json={
            "name": "Ana Teste",
            "email": "ana.semtermos@example.com",
            "password": "SenhaForte123!",
        },
    )
    assert resp.status_code == 422

    resp = client.post(
        "/auth/register",
        json={
            "name": "Ana Teste",
            "email": "ana.semtermos@example.com",
            "password": "SenhaForte123!",
            "accepted_terms": False,
        },
    )
    assert resp.status_code == 422


def test_register_records_terms_acceptance(client):
    from app.models.user import User
    from app.services.auth_service.registration import CURRENT_TERMS_VERSION

    email = "aceite.termos@example.com"
    resp = client.post(
        "/auth/register",
        json={
            "name": "Ana Teste",
            "email": email,
            "password": "SenhaForte123!",
            "accepted_terms": True,
        },
    )
    assert resp.status_code == 201, resp.text

    user = User.objects(email=email).first()
    assert user.terms_acceptance.version == CURRENT_TERMS_VERSION
    assert user.terms_acceptance.accepted_at is not None


def test_business_account_requires_valid_cnpj(client):
    resp = client.post(
        "/auth/register",
        json={
            "name": "Dono Loja",
            "email": "loja.invalida@example.com",
            "password": "SenhaForte123!",
            "account_type": "business",
            "company_name": "Loja LTDA",
            "cnpj": "00.000.000/0000-00",
            "accepted_terms": True,
        },
    )
    assert resp.status_code == 422


def test_business_account_with_valid_cnpj_succeeds(client):
    resp = client.post(
        "/auth/register",
        json={
            "name": "Dono Loja",
            "email": "loja.valida@example.com",
            "password": "SenhaForte123!",
            "account_type": "business",
            "company_name": "Loja LTDA",
            "cnpj": "11.222.333/0001-81",
            "accepted_terms": True,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["user"]["cnpj"] == "11222333000181"


def test_login_blocked_before_email_verification(client):
    email = "nao.verificado@example.com"
    client.post(
        "/auth/register",
        json={
            "name": "Ana",
            "email": email,
            "password": "SenhaForte123!",
            "accepted_terms": True,
        },
    )
    resp = client.post(
        "/auth/login", json={"email": email, "password": "SenhaForte123!"}
    )
    assert resp.status_code == 403


def test_login_wrong_password_returns_401(client, register_user):
    register_user("senha.errada@example.com")
    resp = client.post(
        "/auth/login",
        json={"email": "senha.errada@example.com", "password": "SenhaErrada!"},
    )
    assert resp.status_code == 401


def test_login_success_returns_tokens(client, register_user):
    register_user("login.ok@example.com")
    resp = client.post(
        "/auth/login",
        json={"email": "login.ok@example.com", "password": "SenhaForte123!"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["refresh_token"]


def test_full_register_verify_login_refresh_flow(client):
    email = "fluxo.completo@example.com"
    reg = client.post(
        "/auth/register",
        json={
            "name": "Fluxo Completo",
            "email": email,
            "password": "SenhaForte123!",
            "accepted_terms": True,
        },
    )
    assert reg.status_code == 201

    from app.models.user import User

    user = User.objects(email=email).first()
    verify = client.get(
        "/auth/verify-email", params={"token": user.email_verification_token}
    )
    assert verify.status_code == 200
    assert verify.json()["is_verified"] is True

    login = client.post(
        "/auth/login", json={"email": email, "password": "SenhaForte123!"}
    )
    assert login.status_code == 200
    tokens = login.json()

    me = client.get(
        "/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == email

    refresh = client.post(
        "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh.status_code == 200
    assert refresh.json()["access_token"]
