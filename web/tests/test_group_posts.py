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


def _join(client, token, invite_code):
    resp = client.post(
        "/groups/join",
        json={"invite_code": invite_code},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_member_can_post_and_list_mural(client, register_user):
    _, creator_token = register_user("creator.postbasic@example.com")
    group = _create_group(client, creator_token)
    _, member_token = register_user("member.postbasic@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/posts",
        json={"body": "Reunião sábado às 10h"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["body"] == "Reunião sábado às 10h"
    assert body["author"]["name"] == "Test User"
    assert body["group_id"] == group["id"]

    resp = client.get(
        f"/groups/{group['id']}/posts",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    posts = resp.json()
    assert len(posts) == 1
    assert posts[0]["body"] == "Reunião sábado às 10h"


def test_posts_are_newest_first_and_paginate(client, register_user):
    _, creator_token = register_user("creator.postpaginate@example.com")
    group = _create_group(client, creator_token)

    for i in range(3):
        client.post(
            f"/groups/{group['id']}/posts",
            json={"body": f"Post {i}"},
            headers={"Authorization": f"Bearer {creator_token}"},
        )

    resp = client.get(
        f"/groups/{group['id']}/posts?limit=2",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    page1 = resp.json()
    assert [p["body"] for p in page1] == ["Post 2", "Post 1"]

    resp = client.get(
        f"/groups/{group['id']}/posts?limit=2&before_id={page1[-1]['id']}",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 200, resp.text
    page2 = resp.json()
    assert [p["body"] for p in page2] == ["Post 0"]


def test_non_member_cannot_post_or_list(client, register_user):
    _, creator_token = register_user("creator.postnonmember@example.com")
    group = _create_group(client, creator_token)
    _, outsider_token = register_user("outsider.postnonmember@example.com")

    resp = client.post(
        f"/groups/{group['id']}/posts",
        json={"body": "Tentativa"},
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert resp.status_code == 404

    resp = client.get(
        f"/groups/{group['id']}/posts",
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert resp.status_code == 404


def test_author_can_delete_own_post(client, register_user):
    _, creator_token = register_user("creator.postdeleteself@example.com")
    group = _create_group(client, creator_token)
    _, member_token = register_user("member.postdeleteself@example.com")
    _join(client, member_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/posts",
        json={"body": "Vou apagar"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    post_id = resp.json()["id"]

    resp = client.delete(
        f"/groups/{group['id']}/posts/{post_id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 204

    resp = client.get(
        f"/groups/{group['id']}/posts",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.json() == []


def test_admin_can_read_mural_of_group_theyre_not_in(client, register_user):
    _, creator_token = register_user("creator.postadminread@example.com")
    group = _create_group(client, creator_token)
    client.post(
        f"/groups/{group['id']}/posts",
        json={"body": "Post visível pro admin"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    admin_id, admin_token = register_user("admin.postadminread@example.com")
    _make_admin(admin_id)

    resp = client.get(
        f"/groups/{group['id']}/posts",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1

    resp = client.post(
        f"/groups/{group['id']}/posts",
        json={"body": "Tentativa do admin"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 404


def test_creator_can_delete_others_post_but_regular_member_cannot(
    client, register_user
):
    _, creator_token = register_user("creator.postmoderation@example.com")
    group = _create_group(client, creator_token)
    _, member_a_token = register_user("membera.postmoderation@example.com")
    _join(client, member_a_token, group["invite_code"])
    _, member_b_token = register_user("memberb.postmoderation@example.com")
    _join(client, member_b_token, group["invite_code"])

    resp = client.post(
        f"/groups/{group['id']}/posts",
        json={"body": "Post do membro A"},
        headers={"Authorization": f"Bearer {member_a_token}"},
    )
    post_id = resp.json()["id"]

    resp = client.delete(
        f"/groups/{group['id']}/posts/{post_id}",
        headers={"Authorization": f"Bearer {member_b_token}"},
    )
    assert resp.status_code == 403

    resp = client.delete(
        f"/groups/{group['id']}/posts/{post_id}",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 204


def test_deleting_group_also_deletes_its_mural_posts(client, register_user):
    from app.models.group_post import GroupPost

    _, creator_token = register_user("creator.postorphan@example.com")
    group = _create_group(client, creator_token)
    client.post(
        f"/groups/{group['id']}/posts",
        json={"body": "Vai ficar orfao se não limpar"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert GroupPost.objects(group=group["id"]).count() == 1

    resp = client.delete(
        f"/groups/{group['id']}",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert resp.status_code == 204
    assert GroupPost.objects(group=group["id"]).count() == 0


def test_admin_deleting_group_also_deletes_its_mural_posts(client, register_user):
    from app.models.group_post import GroupPost

    _, creator_token = register_user("creator.postorphanadmin@example.com")
    group = _create_group(client, creator_token)
    client.post(
        f"/groups/{group['id']}/posts",
        json={"body": "Vai ficar orfao se não limpar"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    admin_id, admin_token = register_user("admin.postorphanadmin@example.com")
    _make_admin(admin_id)

    resp = client.delete(
        f"/admin/groups/{group['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204
    assert GroupPost.objects(group=group["id"]).count() == 0


def test_admin_deleting_group_notifies_members(client, register_user):
    _, creator_token = register_user("creator.notifadmindelete@example.com")
    group = _create_group(client, creator_token)
    admin_id, admin_token = register_user("admin.notifadmindelete@example.com")
    _make_admin(admin_id)

    resp = client.delete(
        f"/admin/groups/{group['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204

    resp = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {creator_token}"}
    )
    assert "group_membership_changed" in [n["type"] for n in resp.json()]


def test_admin_removing_member_notifies_target(client, register_user):
    _, creator_token = register_user("creator.notifadminremove@example.com")
    group = _create_group(client, creator_token)
    member_id, member_token = register_user("member.notifadminremove@example.com")
    _join(client, member_token, group["invite_code"])
    admin_id, admin_token = register_user("admin.notifadminremove@example.com")
    _make_admin(admin_id)

    resp = client.delete(
        f"/admin/groups/{group['id']}/members/{member_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text

    resp = client.get(
        "/notifications/", headers={"Authorization": f"Bearer {member_token}"}
    )
    assert "group_membership_changed" in [n["type"] for n in resp.json()]
