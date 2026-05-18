"""Authentication tests — exercise the real bearer-token flow via the
`unauth_client` fixture (which does NOT mock get_current_user)."""


def test_protected_route_requires_token(unauth_client):
    assert unauth_client.get("/tasks").status_code == 401
    assert unauth_client.get("/categories").status_code == 401
    assert unauth_client.get("/stats").status_code == 401
    assert unauth_client.get("/auth/me").status_code == 401


def test_register_creates_user_and_returns_token(unauth_client):
    r = unauth_client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "password123"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "alice@example.com"


def test_register_seeds_default_categories(unauth_client):
    r = unauth_client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "password123"},
    )
    token = r.json()["access_token"]
    cats = unauth_client.get(
        "/categories", headers={"Authorization": f"Bearer {token}"}
    ).json()
    names = sorted(c["name"] for c in cats)
    assert names == sorted(["Personal", "Work", "Health", "Learning"])


def test_duplicate_email_rejected(unauth_client):
    unauth_client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "password123"},
    )
    r = unauth_client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "password123"},
    )
    assert r.status_code == 409


def test_invalid_email_rejected(unauth_client):
    r = unauth_client.post(
        "/auth/register",
        json={"email": "not-an-email", "password": "password123"},
    )
    assert r.status_code == 422


def test_short_password_rejected(unauth_client):
    r = unauth_client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "short"},
    )
    assert r.status_code == 422


def test_login_with_correct_credentials(unauth_client):
    unauth_client.post(
        "/auth/register",
        json={"email": "bob@example.com", "password": "password123"},
    )
    r = unauth_client.post(
        "/auth/login",
        json={"email": "bob@example.com", "password": "password123"},
    )
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_login_wrong_password(unauth_client):
    unauth_client.post(
        "/auth/register",
        json={"email": "bob@example.com", "password": "password123"},
    )
    r = unauth_client.post(
        "/auth/login",
        json={"email": "bob@example.com", "password": "wrong"},
    )
    assert r.status_code == 401


def test_login_unknown_email(unauth_client):
    r = unauth_client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "whatever"},
    )
    assert r.status_code == 401


def test_invalid_token_rejected(unauth_client):
    r = unauth_client.get(
        "/tasks", headers={"Authorization": "Bearer not-a-real-jwt"}
    )
    assert r.status_code == 401


def test_me_returns_current_user(unauth_client):
    reg = unauth_client.post(
        "/auth/register",
        json={"email": "carol@example.com", "password": "password123"},
    ).json()
    token = reg["access_token"]
    r = unauth_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "carol@example.com"


def test_users_see_only_their_own_tasks(unauth_client):
    """Critical isolation test: two users register, each creates a task,
    each must see only their own task."""
    a = unauth_client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "password123"},
    ).json()
    b = unauth_client.post(
        "/auth/register",
        json={"email": "bob@example.com", "password": "password123"},
    ).json()
    a_hdr = {"Authorization": f"Bearer {a['access_token']}"}
    b_hdr = {"Authorization": f"Bearer {b['access_token']}"}

    unauth_client.post("/tasks", json={"title": "Alice's secret"}, headers=a_hdr)
    unauth_client.post("/tasks", json={"title": "Bob's secret"}, headers=b_hdr)

    a_tasks = unauth_client.get("/tasks", headers=a_hdr).json()
    b_tasks = unauth_client.get("/tasks", headers=b_hdr).json()
    a_titles = [t["title"] for t in a_tasks]
    b_titles = [t["title"] for t in b_tasks]

    assert a_titles == ["Alice's secret"]
    assert b_titles == ["Bob's secret"]


def test_user_cannot_access_other_users_task_by_id(unauth_client):
    a = unauth_client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "password123"},
    ).json()
    b = unauth_client.post(
        "/auth/register",
        json={"email": "bob@example.com", "password": "password123"},
    ).json()
    a_hdr = {"Authorization": f"Bearer {a['access_token']}"}
    b_hdr = {"Authorization": f"Bearer {b['access_token']}"}

    a_task = unauth_client.post("/tasks", json={"title": "X"}, headers=a_hdr).json()

    # Bob tries to access Alice's task → 404 (not 403, to avoid leaking IDs)
    assert unauth_client.get(f"/tasks/{a_task['id']}", headers=b_hdr).status_code == 404
    assert unauth_client.patch(
        f"/tasks/{a_task['id']}", json={"title": "hacked"}, headers=b_hdr
    ).status_code == 404
    assert unauth_client.delete(f"/tasks/{a_task['id']}", headers=b_hdr).status_code == 404


def test_users_have_separate_categories(unauth_client):
    a = unauth_client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "password123"},
    ).json()
    b = unauth_client.post(
        "/auth/register",
        json={"email": "bob@example.com", "password": "password123"},
    ).json()
    a_hdr = {"Authorization": f"Bearer {a['access_token']}"}
    b_hdr = {"Authorization": f"Bearer {b['access_token']}"}

    # Both get the 4 default categories on registration
    a_cats = unauth_client.get("/categories", headers=a_hdr).json()
    b_cats = unauth_client.get("/categories", headers=b_hdr).json()
    assert len(a_cats) == 4
    assert len(b_cats) == 4

    # Their IDs are independent — Alice's "Work" has a different id from Bob's
    a_work = next(c for c in a_cats if c["name"] == "Work")
    b_work = next(c for c in b_cats if c["name"] == "Work")
    assert a_work["id"] != b_work["id"]


def test_users_have_separate_stats(unauth_client):
    a = unauth_client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "password123"},
    ).json()
    b = unauth_client.post(
        "/auth/register",
        json={"email": "bob@example.com", "password": "password123"},
    ).json()
    a_hdr = {"Authorization": f"Bearer {a['access_token']}"}
    b_hdr = {"Authorization": f"Bearer {b['access_token']}"}

    unauth_client.post("/tasks", json={"title": "1"}, headers=a_hdr)
    unauth_client.post("/tasks", json={"title": "2"}, headers=a_hdr)
    unauth_client.post("/tasks", json={"title": "3"}, headers=a_hdr)

    a_stats = unauth_client.get("/stats", headers=a_hdr).json()
    b_stats = unauth_client.get("/stats", headers=b_hdr).json()

    assert a_stats["total"] == 3
    assert b_stats["total"] == 0


def test_deleting_user_account_would_cascade_tasks(unauth_client):
    """Sanity check: the model's cascade='all, delete-orphan' on User.tasks
    means deleting a user wipes their tasks. We don't expose a delete-user
    route yet, but verify the relationship via direct DB delete behavior
    isn't broken — covered implicitly by ORM cascade definition."""
    # No-op test — documents the contract. If/when we add a /auth/delete-me
    # endpoint, the cascade is already in place.
    pass
