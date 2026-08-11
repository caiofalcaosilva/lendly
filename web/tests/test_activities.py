from datetime import datetime
from unittest.mock import patch

from app.models.activity import Activity
from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.payment import Payment
from app.models.user import User
from app.services import activity_service, payment_service


def _get_user(user_id: str) -> User:
    return User.objects(id=user_id).first()


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


def _create_request(client, token, item_id, **overrides):
    payload = {
        "item_id": item_id,
        "pickup_date": "2026-09-01T10:00:00",
        "expected_return_date": "2026-09-03T10:00:00",
        **overrides,
    }
    resp = client.post(
        "/requests/", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _activities(client, token):
    resp = client.get("/activities/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    return resp.json()


def _make_admin(user_id: str) -> None:
    User.objects(id=user_id).update(is_admin=True)


def test_record_creates_activity_for_recipient(client, register_user):
    owner_id, _ = register_user("owner.activity@example.com")
    requester_id, _ = register_user("requester.activity@example.com")
    owner = _get_user(owner_id)
    requester = _get_user(requester_id)

    activity_service.record(
        recipient=owner,
        event="rental.requested",
        resource_type="loan_request",
        resource_id="abc123",
        actor=requester,
        resource_title="Furadeira",
        metadata={"pickup_date": "2026-09-01"},
    )

    stored = Activity.objects(recipient=owner).first()
    assert stored is not None
    assert stored.event == "rental.requested"
    assert str(stored.actor.id) == requester_id
    assert stored.actor_name == requester.name
    assert stored.resource_type == "loan_request"
    assert stored.resource_id == "abc123"
    assert stored.resource_title == "Furadeira"
    assert stored.metadata == {"pickup_date": "2026-09-01"}


def test_record_without_actor_is_system_event(client, register_user):
    user_id, _ = register_user("system.activity@example.com")
    user = _get_user(user_id)

    activity_service.record(
        recipient=user,
        event="payment.held",
        resource_type="payment",
        resource_id="pay1",
    )

    stored = Activity.objects(recipient=user).first()
    assert stored.actor is None
    assert stored.actor_name is None


def test_record_failure_is_swallowed_not_raised(client, register_user):
    user_id, _ = register_user("failure.activity@example.com")
    user = _get_user(user_id)

    with patch.object(Activity, "save", side_effect=RuntimeError("boom")):
        activity_service.record(
            recipient=user,
            event="item.created",
            resource_type="item",
            resource_id="item1",
        )

    assert Activity.objects(recipient=user).count() == 0


def test_list_activities_scoped_to_recipient(client, register_user):
    a_id, _ = register_user("a.activity@example.com")
    b_id, _ = register_user("b.activity@example.com")
    a = _get_user(a_id)
    b = _get_user(b_id)

    activity_service.record(
        recipient=a,
        event="item.created",
        resource_type="item",
        resource_id="item-a",
    )
    activity_service.record(
        recipient=b,
        event="item.created",
        resource_type="item",
        resource_id="item-b",
    )

    a_activities = activity_service.list_activities(a, before_id=None, limit=20)
    assert len(a_activities) == 1
    assert a_activities[0].resource.id == "item-a"


def test_list_activities_pagination_cursor(client, register_user):
    user_id, _ = register_user("cursor.activity@example.com")
    user = _get_user(user_id)

    for i in range(5):
        activity_service.record(
            recipient=user,
            event="item.created",
            resource_type="item",
            resource_id=f"item-{i}",
        )

    first_page = activity_service.list_activities(user, before_id=None, limit=2)
    assert len(first_page) == 2
    assert [a.resource.id for a in first_page] == ["item-4", "item-3"]

    second_page = activity_service.list_activities(
        user, before_id=first_page[-1].id, limit=2
    )
    assert [a.resource.id for a in second_page] == ["item-2", "item-1"]


def test_activities_endpoint_requires_auth(client):
    resp = client.get("/activities/")
    assert resp.status_code == 403


def test_activities_endpoint_scoped_to_current_user(client, register_user):
    a_id, a_token = register_user("a.endpoint@example.com")
    b_id, b_token = register_user("b.endpoint@example.com")
    a = _get_user(a_id)

    activity_service.record(
        recipient=a, event="item.created", resource_type="item", resource_id="item-a"
    )

    resp_a = client.get("/activities/", headers={"Authorization": f"Bearer {a_token}"})
    assert resp_a.status_code == 200
    body = resp_a.json()
    assert len(body) == 1
    assert body[0]["event"] == "item.created"
    assert body[0]["resource"] == {"type": "item", "id": "item-a", "title": None}

    resp_b = client.get("/activities/", headers={"Authorization": f"Bearer {b_token}"})
    assert resp_b.json() == []


def test_activities_endpoint_rejects_invalid_event_filter(client, register_user):
    _, token = register_user("invalidevent.endpoint@example.com")
    resp = client.get(
        "/activities/?event=not_a_real_event",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


def test_list_activities_filters_by_event_and_resource_type(client, register_user):
    user_id, _ = register_user("filter.activity@example.com")
    user = _get_user(user_id)

    activity_service.record(
        recipient=user, event="item.created", resource_type="item", resource_id="i1"
    )
    activity_service.record(
        recipient=user,
        event="rental.requested",
        resource_type="loan_request",
        resource_id="r1",
    )

    by_event = activity_service.list_activities(
        user, before_id=None, limit=20, event="item.created"
    )
    assert len(by_event) == 1
    assert by_event[0].event == "item.created"

    by_resource = activity_service.list_activities(
        user, before_id=None, limit=20, resource_type="loan_request"
    )
    assert len(by_resource) == 1
    assert by_resource[0].resource.type == "loan_request"


def test_creating_request_records_activity_for_both_sides(client, register_user):
    _, owner_token = register_user("owner.reqcreate@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("requester.reqcreate@example.com")
    req = _create_request(client, requester_token, item["id"])

    owner_events = [a["event"] for a in _activities(client, owner_token)]
    requester_events = [a["event"] for a in _activities(client, requester_token)]
    assert owner_events == ["rental.requested", "item.created"]
    assert requester_events == ["rental.requested"]

    requester_activity = _activities(client, requester_token)[0]
    assert requester_activity["resource"] == {
        "type": "loan_request",
        "id": req["id"],
        "title": "Furadeira",
    }


def test_accepting_request_records_activity_for_both_sides(client, register_user):
    _, owner_token = register_user("owner.reqaccept@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("requester.reqaccept@example.com")
    req = _create_request(client, requester_token, item["id"])

    resp = client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 200

    owner_events = [a["event"] for a in _activities(client, owner_token)]
    requester_events = [a["event"] for a in _activities(client, requester_token)]
    assert owner_events == ["rental.accepted", "rental.requested", "item.created"]
    assert requester_events == ["rental.accepted", "rental.requested"]


def test_refusing_request_records_activity_for_both_sides(client, register_user):
    _, owner_token = register_user("owner.reqrefuse@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("requester.reqrefuse@example.com")
    req = _create_request(client, requester_token, item["id"])

    client.patch(
        f"/requests/{req['id']}/refuse",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    owner_events = [a["event"] for a in _activities(client, owner_token)]
    assert owner_events == ["rental.refused", "rental.requested", "item.created"]


def test_full_pickup_and_return_cycle_records_expected_events(client, register_user):
    _, owner_token = register_user("owner.reqcycle@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("requester.reqcycle@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    client.patch(
        f"/requests/{req['id']}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/start",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/finish",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/finish",
        headers={"Authorization": f"Bearer {requester_token}"},
    )

    owner_events = [a["event"] for a in _activities(client, owner_token)]
    assert owner_events == [
        "rental.finished",
        "rental.return_confirmed",
        "rental.return_confirmed",
        "rental.started",
        "rental.pickup_confirmed",
        "rental.pickup_confirmed",
        "rental.accepted",
        "rental.requested",
        "item.created",
    ]


def test_cancelling_request_records_activity_for_both_sides(client, register_user):
    _, owner_token = register_user("owner.reqcancel@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("requester.reqcancel@example.com")
    req = _create_request(client, requester_token, item["id"])

    client.patch(
        f"/requests/{req['id']}/cancel",
        headers={"Authorization": f"Bearer {requester_token}"},
    )

    owner_events = [a["event"] for a in _activities(client, owner_token)]
    requester_events = [a["event"] for a in _activities(client, requester_token)]
    assert owner_events == ["rental.cancelled", "rental.requested", "item.created"]
    assert requester_events == ["rental.cancelled", "rental.requested"]


# --- Fase 4: item, payment, review, verification, group -----------------


def test_create_and_pause_and_resume_and_remove_item_records_activity(
    client, register_user
):
    _, owner_token = register_user("owner.itemlifecycle@example.com")
    item = _create_item(client, owner_token)

    events = [a["event"] for a in _activities(client, owner_token)]
    assert events == ["item.created"]

    client.patch(
        f"/items/{item['id']}/deactivate",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/items/{item['id']}/activate",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.delete(
        f"/items/{item['id']}", headers={"Authorization": f"Bearer {owner_token}"}
    )

    events = [a["event"] for a in _activities(client, owner_token)]
    assert events == ["item.removed", "item.resumed", "item.paused", "item.created"]


def test_updating_item_price_records_activity_for_owner_and_favoriters(
    client, register_user
):
    _, owner_token = register_user("owner.itemprice@example.com")
    item = _create_item(client, owner_token, availability_type="free")
    _, fan_token = register_user("fan.itemprice@example.com")
    client.post(
        f"/items/{item['id']}/favorite",
        headers={"Authorization": f"Bearer {fan_token}"},
    )

    resp = client.put(
        f"/items/{item['id']}",
        json={"description": "novo texto"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 200, resp.text
    # description-only edit shouldn't produce an item.updated (no price/
    # availability change) — confirm before triggering a real one below.
    assert [a["event"] for a in _activities(client, owner_token)] == ["item.created"]

    resp = client.put(
        f"/items/{item['id']}",
        json={"daily_rate": 25},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 200, resp.text

    owner_events = [a["event"] for a in _activities(client, owner_token)]
    fan_events = [a["event"] for a in _activities(client, fan_token)]
    assert owner_events[0] == "item.updated"
    assert fan_events[0] == "item.updated"


def test_review_submitted_records_activity_for_both_sides(client, register_user):
    _, owner_token = register_user("owner.review@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("requester.review@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/start",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/finish",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/finish",
        headers={"Authorization": f"Bearer {requester_token}"},
    )

    resp = client.post(
        f"/reviews/request/{req['id']}",
        json={"rating": 5, "comment": "Ótimo!"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert resp.status_code == 201, resp.text

    owner_events = [a["event"] for a in _activities(client, owner_token)]
    requester_events = [a["event"] for a in _activities(client, requester_token)]
    assert owner_events[0] == "review.submitted"
    assert requester_events[0] == "review.submitted"


def test_group_vouch_records_activity_for_target(client, register_user):
    _, creator_token = register_user("creator.vouch@example.com")
    resp = client.post(
        "/groups/",
        json={"name": "Vizinhos do Bloco A"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    group = resp.json()

    _, member_token = register_user("member.vouch@example.com")
    client.post(
        "/groups/join",
        json={"invite_code": group["invite_code"]},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    member_id = _get_user(
        client.get(
            "/users/me", headers={"Authorization": f"Bearer {member_token}"}
        ).json()["id"]
    ).id

    resp = client.post(
        f"/groups/{group['id']}/members/{member_id}/vouch",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text

    events = _activities(client, member_token)
    assert events[0]["event"] == "group.vouch_received"
    assert events[0]["resource"]["title"] == "Vizinhos do Bloco A"


def _make_paid_loan_request():
    owner = User(
        name="Dono Pagamento",
        email="dono.activity.payment@example.com",
        password_hash="x",
        is_verified=True,
        mp_user_id="MP-OWNER-ACT",
    ).save()
    requester = User(
        name="Solicitante Pagamento",
        email="solicitante.activity.payment@example.com",
        password_hash="x",
    ).save()
    item = Item(
        owner=owner,
        title="Furadeira",
        category="toys",
        availability_type="paid",
        daily_rate=50.0,
    ).save()
    req = LoanRequest(
        item=item,
        requester=requester,
        owner=owner,
        pickup_date=datetime(2026, 9, 1),
        expected_return_date=datetime(2026, 9, 3),
        payment_status="held",
    ).save()
    payment = Payment(
        loan_request=req,
        payer=requester,
        payee=owner,
        gross_amount=100.0,
        platform_fee_amount=5.0,
        status="held",
        mp_payment_id="mp-123",
    ).save()
    return req, payment


def test_release_payment_records_activity_for_payer_and_payee(client):
    req, payment = _make_paid_loan_request()
    with patch.object(
        payment_service.mercadopago_gateway, "release_payment", return_value=None
    ):
        payment_service.release_payment(req)

    payer_activities = activity_service.list_activities(
        req.requester, before_id=None, limit=10
    )
    payee_activities = activity_service.list_activities(
        req.owner, before_id=None, limit=10
    )
    assert payer_activities[0].event == "payment.released"
    assert payee_activities[0].event == "payment.released"
    assert payer_activities[0].metadata == {
        "gross_amount": 100.0,
        "platform_fee_amount": 5.0,
    }


def test_refund_payment_records_activity_for_payer_and_payee(client):
    req, payment = _make_paid_loan_request()
    with patch.object(
        payment_service.mercadopago_gateway, "refund_payment", return_value=None
    ):
        payment_service.refund_payment(req)

    payer_activities = activity_service.list_activities(
        req.requester, before_id=None, limit=10
    )
    assert payer_activities[0].event == "payment.refunded"


# --- Fase 5: admin actions and account security --------------------------


def test_admin_deactivate_and_activate_user_records_activity_for_target(
    client, register_user
):
    admin_id, admin_token = register_user("admin.userstatus@example.com")
    _make_admin(admin_id)
    target_id, target_token = register_user("target.userstatus@example.com")

    client.patch(
        f"/admin/users/{target_id}/deactivate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    # Reactivate so we can log back in as the target and read their feed.
    client.patch(
        f"/admin/users/{target_id}/activate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    events = [a["event"] for a in _activities(client, target_token)]
    assert events == ["admin.user_activated", "admin.user_deactivated"]
    assert _activities(client, target_token)[0]["actor"]["id"] == admin_id
    # The admin's own feed is untouched — the activity belongs to the target.
    assert _activities(client, admin_token) == []


def test_admin_promote_and_demote_user_records_activity_for_target(
    client, register_user
):
    admin_id, admin_token = register_user("admin.userrank@example.com")
    _make_admin(admin_id)
    target_id, target_token = register_user("target.userrank@example.com")

    client.patch(
        f"/admin/users/{target_id}/promote",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    client.patch(
        f"/admin/users/{target_id}/demote",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    events = [a["event"] for a in _activities(client, target_token)]
    assert events == ["admin.user_demoted", "admin.user_promoted"]


def test_admin_deactivate_and_activate_item_records_activity_for_owner(
    client, register_user
):
    admin_id, admin_token = register_user("admin.itemstatus@example.com")
    _make_admin(admin_id)
    owner_id, owner_token = register_user("owner.itemstatus@example.com")
    item = _create_item(client, owner_token)

    client.patch(
        f"/admin/items/{item['id']}/deactivate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    client.patch(
        f"/admin/items/{item['id']}/activate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    events = [a["event"] for a in _activities(client, owner_token)]
    assert events == [
        "admin.item_activated",
        "admin.item_deactivated",
        "item.created",
    ]


def test_report_dismiss_and_action_record_activity_for_reporter(client, register_user):
    admin_id, admin_token = register_user("admin.report@example.com")
    _make_admin(admin_id)
    owner_id, owner_token = register_user("owner.report@example.com")
    item = _create_item(client, owner_token)
    _, reporter_token = register_user("reporter.report@example.com")

    resp = client.post(
        "/reports/",
        json={"item_id": item["id"], "reason": "spam"},
        headers={"Authorization": f"Bearer {reporter_token}"},
    )
    assert resp.status_code == 201, resp.text
    report = resp.json()

    resp = client.patch(
        f"/reports/{report['id']}/dismiss",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text

    events = _activities(client, reporter_token)
    assert events[0]["event"] == "admin.report_dismissed"
    assert events[0]["resource"]["title"] == "Furadeira"


def test_new_login_on_untrusted_device_records_activity(client, register_user):
    user_id, _ = register_user("newlogin.activity@example.com")
    resp = client.post(
        "/auth/login",
        json={"email": "newlogin.activity@example.com", "password": "SenhaForte123!"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    events = [a["event"] for a in _activities(client, token)]
    assert "account.new_login" in events


# --- Follow-up audit: extension requests + account security actions -----


def test_loan_extension_lifecycle_records_activity_for_both_sides(
    client, register_user
):
    _, owner_token = register_user("owner.extension@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("requester.extension@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/start",
        headers={"Authorization": f"Bearer {requester_token}"},
    )

    resp = client.post(
        f"/requests/{req['id']}/extend",
        json={"new_expected_return_date": "2026-09-05T10:00:00"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert resp.status_code == 201, resp.text

    owner_events = [a["event"] for a in _activities(client, owner_token)]
    assert owner_events[0] == "rental.extension_requested"

    resp = client.patch(
        f"/requests/{req['id']}/extension/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 200, resp.text

    requester_events = [a["event"] for a in _activities(client, requester_token)]
    assert requester_events[0] == "rental.extension_approved"


def test_loan_extension_rejected_records_activity(client, register_user):
    _, owner_token = register_user("owner.extensionreject@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("requester.extensionreject@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/start",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    client.post(
        f"/requests/{req['id']}/extend",
        json={"new_expected_return_date": "2026-09-05T10:00:00"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )

    resp = client.patch(
        f"/requests/{req['id']}/extension/reject",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 200, resp.text

    requester_events = [a["event"] for a in _activities(client, requester_token)]
    assert requester_events[0] == "rental.extension_rejected"


def test_change_password_records_activity(client, register_user):
    _, token = register_user("changepw.activity@example.com")
    resp = client.put(
        "/users/me/password",
        json={"current_password": "SenhaForte123!", "new_password": "OutraSenha456!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text

    events = [a["event"] for a in _activities(client, token)]
    assert events[0] == "account.password_changed"


def test_change_email_records_activity(client, register_user):
    _, token = register_user("changeemail.activity@example.com")
    resp = client.put(
        "/users/me/email",
        json={
            "new_email": "novo.email.activity@example.com",
            "password": "SenhaForte123!",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text

    events = _activities(client, token)
    assert events[0]["event"] == "account.email_changed"
    assert events[0]["metadata"] == {"new_email": "novo.email.activity@example.com"}


def test_pause_and_resume_account_record_activity(client, register_user):
    _, token = register_user("pauseaccount.activity@example.com")
    client.post("/users/me/pause", headers={"Authorization": f"Bearer {token}"})
    client.post("/users/me/resume", headers={"Authorization": f"Bearer {token}"})

    events = [a["event"] for a in _activities(client, token)]
    assert events == ["account.resumed", "account.paused"]


def test_enable_and_disable_2fa_record_activity(client, register_user):
    _, token = register_user("totp.activity@example.com")
    setup = client.post("/auth/2fa/setup", headers={"Authorization": f"Bearer {token}"})
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]

    import pyotp

    code = pyotp.TOTP(secret).now()
    resp = client.post(
        "/auth/2fa/enable",
        json={"code": code},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text

    code = pyotp.TOTP(secret).now()
    resp = client.post(
        "/auth/2fa/disable",
        json={"code": code},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text

    events = [a["event"] for a in _activities(client, token)]
    assert events == ["account.2fa_disabled", "account.2fa_enabled"]


def test_password_reset_records_activity(client, register_user):
    email = "resetpw.activity@example.com"
    user_id, token = register_user(email)
    Activity.objects(recipient=user_id).delete()

    forgot = client.post("/auth/forgot-password", json={"email": email})
    assert forgot.status_code == 200, forgot.text
    reset_token = User.objects(id=user_id).first().password_reset_token
    assert reset_token

    resp = client.post(
        "/auth/reset-password",
        json={"token": reset_token, "new_password": "NovaSenhaReset789!"},
    )
    assert resp.status_code == 200, resp.text

    activities = activity_service.list_activities(
        _get_user(user_id), before_id=None, limit=10
    )
    assert activities[0].event == "account.password_reset"
    assert activities[0].actor is None


def test_mercadopago_connect_records_activity(client, register_user):
    from app.services import mp_connect_service

    user_id, _ = register_user("mpconnect.activity@example.com")
    user = _get_user(user_id)
    user.update(mp_oauth_state="state-token")
    user.reload()

    with patch.object(
        mp_connect_service.mercadopago_gateway,
        "exchange_oauth_code",
        return_value={
            "user_id": "MP-USER-1",
            "access_token": "at",
            "refresh_token": "rt",
            "expires_in": 100,
        },
    ):
        mp_connect_service.handle_callback("code", "state-token", user)

    activities = activity_service.list_activities(user, before_id=None, limit=10)
    assert activities[0].event == "account.mercadopago_connected"


def test_export_data_records_activity(client, register_user):
    user_id, token = register_user("exportdata.activity@example.com")

    resp = client.get("/users/me/export", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text

    events = [a["event"] for a in _activities(client, token)]
    assert events[0] == "account.data_exported"


# --- Second follow-up: admin group/review moderation actions -------------


def test_admin_remove_member_records_activity_for_target(client, register_user):
    admin_id, admin_token = register_user("admin.groupremove@example.com")
    _make_admin(admin_id)
    _, creator_token = register_user("creator.groupremove@example.com")
    resp = client.post(
        "/groups/",
        json={"name": "Grupo Moderado"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    group = resp.json()
    _, member_token = register_user("member.groupremove@example.com")
    client.post(
        "/groups/join",
        json={"invite_code": group["invite_code"]},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    member_id = client.get(
        "/users/me", headers={"Authorization": f"Bearer {member_token}"}
    ).json()["id"]

    resp = client.delete(
        f"/admin/groups/{group['id']}/members/{member_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text

    events = _activities(client, member_token)
    assert events[0]["event"] == "admin.group_member_removed"
    assert events[0]["resource"]["title"] == "Grupo Moderado"
    assert events[0]["actor"]["id"] == admin_id


def test_admin_delete_group_records_activity_for_creator(client, register_user):
    admin_id, admin_token = register_user("admin.groupdelete@example.com")
    _make_admin(admin_id)
    _, creator_token = register_user("creator.groupdelete@example.com")
    resp = client.post(
        "/groups/",
        json={"name": "Grupo pra Apagar"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    group = resp.json()

    resp = client.delete(
        f"/admin/groups/{group['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204, resp.text

    events = _activities(client, creator_token)
    assert events[0]["event"] == "admin.group_deleted"
    assert events[0]["resource"]["title"] == "Grupo pra Apagar"


def test_admin_delete_review_records_activity_for_both_sides(client, register_user):
    admin_id, admin_token = register_user("admin.reviewdelete@example.com")
    _make_admin(admin_id)
    _, owner_token = register_user("owner.reviewdelete@example.com")
    item = _create_item(client, owner_token)
    _, requester_token = register_user("requester.reviewdelete@example.com")
    req = _create_request(client, requester_token, item["id"])
    client.patch(
        f"/requests/{req['id']}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/start",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/start",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/finish",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.patch(
        f"/requests/{req['id']}/finish",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    resp = client.post(
        f"/reviews/request/{req['id']}",
        json={"rating": 5, "comment": "Ótimo!"},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    review = resp.json()

    resp = client.delete(
        f"/admin/reviews/{review['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204, resp.text

    owner_events = [a["event"] for a in _activities(client, owner_token)]
    requester_events = [a["event"] for a in _activities(client, requester_token)]
    assert owner_events[0] == "admin.review_deleted"
    assert requester_events[0] == "admin.review_deleted"


def test_admin_view_as_records_activity_for_target(client, register_user):
    admin_id, admin_token = register_user("admin.viewas@example.com")
    _make_admin(admin_id)
    target_id, target_token = register_user("target.viewas@example.com")

    resp = client.post(
        f"/admin/users/{target_id}/view-as",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text

    events = _activities(client, target_token)
    assert events[0]["event"] == "admin.user_viewed"
    assert events[0]["actor"]["id"] == admin_id


# --- Third follow-up: self-service group lifecycle + filing a report -----


def test_group_lifecycle_records_activity(client, register_user):
    _, creator_token = register_user("creator.grouplifecycle@example.com")
    resp = client.post(
        "/groups/",
        json={"name": "Vizinhos do Bloco B"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 201, resp.text
    group = resp.json()

    creator_events = [a["event"] for a in _activities(client, creator_token)]
    assert creator_events == ["group.created"]

    _, member_token = register_user("member.grouplifecycle@example.com")
    resp = client.post(
        "/groups/join",
        json={"invite_code": group["invite_code"]},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200, resp.text
    member_events = [a["event"] for a in _activities(client, member_token)]
    assert member_events == ["group.joined"]

    resp = client.post(
        f"/groups/{group['id']}/leave",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200, resp.text
    member_events = [a["event"] for a in _activities(client, member_token)]
    assert member_events == ["group.left", "group.joined"]

    resp = client.delete(
        f"/groups/{group['id']}", headers={"Authorization": f"Bearer {creator_token}"}
    )
    assert resp.status_code == 204, resp.text
    creator_events = [a["event"] for a in _activities(client, creator_token)]
    assert creator_events == ["group.deleted", "group.created"]


def test_unvouch_records_activity_for_target(client, register_user):
    _, creator_token = register_user("creator.unvouch@example.com")
    resp = client.post(
        "/groups/",
        json={"name": "Grupo Unvouch"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    group = resp.json()
    _, member_token = register_user("member.unvouch@example.com")
    client.post(
        "/groups/join",
        json={"invite_code": group["invite_code"]},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    member_id = client.get(
        "/users/me", headers={"Authorization": f"Bearer {member_token}"}
    ).json()["id"]

    client.post(
        f"/groups/{group['id']}/members/{member_id}/vouch",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    resp = client.delete(
        f"/groups/{group['id']}/members/{member_id}/vouch",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text

    events = [a["event"] for a in _activities(client, member_token)]
    assert events == ["group.vouch_withdrawn", "group.vouch_received", "group.joined"]


def test_filing_report_records_activity_for_reporter(client, register_user):
    _, owner_token = register_user("owner.reportfiled@example.com")
    item = _create_item(client, owner_token)
    _, reporter_token = register_user("reporter.reportfiled@example.com")

    resp = client.post(
        "/reports/",
        json={"item_id": item["id"], "reason": "spam"},
        headers={"Authorization": f"Bearer {reporter_token}"},
    )
    assert resp.status_code == 201, resp.text

    events = _activities(client, reporter_token)
    assert events[0]["event"] == "report.filed"
    assert events[0]["resource"]["title"] == "Furadeira"
