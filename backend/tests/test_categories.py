"""Category CRUD + side effects on tasks."""
from tests.conftest import make_category, make_task


def test_list_empty(client):
    r = client.get("/categories")
    assert r.status_code == 200
    assert r.json() == []


def test_create_category_returns_id_and_timestamp(client):
    r = client.post("/categories", json={"name": "Work", "color": "#06b6d4"})
    assert r.status_code == 200
    data = r.json()
    assert data["id"] > 0
    assert data["name"] == "Work"
    assert data["color"] == "#06b6d4"
    assert "created_at" in data


def test_create_defaults_color(client):
    r = client.post("/categories", json={"name": "Plain"})
    assert r.status_code == 200
    assert r.json()["color"] == "#6366f1"  # schema default


def test_list_orders_alphabetically(client):
    make_category(client, name="Zebra")
    make_category(client, name="Apple")
    make_category(client, name="Mango")
    names = [c["name"] for c in client.get("/categories").json()]
    assert names == ["Apple", "Mango", "Zebra"]


def test_update_category(client):
    cat = make_category(client, name="Old", color="#000000")
    r = client.patch(f"/categories/{cat['id']}", json={"name": "New", "color": "#ffffff"})
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "New"
    assert data["color"] == "#ffffff"


def test_update_partial_keeps_other_fields(client):
    cat = make_category(client, name="Keep", color="#abcdef")
    r = client.patch(f"/categories/{cat['id']}", json={"name": "Changed"})
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Changed"
    assert data["color"] == "#abcdef"  # unchanged


def test_update_missing_returns_404(client):
    r = client.patch("/categories/99999", json={"name": "Ghost"})
    assert r.status_code == 404


def test_delete_category(client):
    cat = make_category(client)
    r = client.delete(f"/categories/{cat['id']}")
    assert r.status_code == 200
    assert client.get("/categories").json() == []


def test_delete_missing_returns_404(client):
    r = client.delete("/categories/99999")
    assert r.status_code == 404


def test_delete_category_unsets_category_id_on_tasks(client):
    """Critical: deleting a category must NOT cascade-delete tasks. It should
    just null out the foreign key so tasks survive uncategorized."""
    cat = make_category(client, name="Work")
    task = make_task(client, title="orphan-me", category_id=cat["id"])
    assert task["category_id"] == cat["id"]

    client.delete(f"/categories/{cat['id']}")

    # Task survives — but its category_id is now null
    refetched = client.get(f"/tasks/{task['id']}").json()
    assert refetched["category_id"] is None
    assert refetched["category"] is None
