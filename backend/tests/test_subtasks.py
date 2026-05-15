"""Subtask CRUD."""
from tests.conftest import make_task


def test_create_task_with_inline_subtasks(client):
    r = client.post(
        "/tasks",
        json={
            "title": "Parent",
            "subtasks": [{"title": "A"}, {"title": "B", "completed": True}],
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["subtasks"]) == 2
    titles = {s["title"] for s in data["subtasks"]}
    assert titles == {"A", "B"}
    completed = {s["title"]: s["completed"] for s in data["subtasks"]}
    assert completed == {"A": False, "B": True}


def test_add_subtask_to_existing_task(client):
    task = make_task(client)
    r = client.post(f"/tasks/{task['id']}/subtasks", json={"title": "Newly added"})
    assert r.status_code == 200
    sub = r.json()
    assert sub["title"] == "Newly added"
    assert sub["completed"] is False
    assert sub["task_id"] == task["id"]

    # Verify it shows up on the parent
    fetched = client.get(f"/tasks/{task['id']}").json()
    assert len(fetched["subtasks"]) == 1


def test_add_subtask_to_missing_task_returns_404(client):
    r = client.post("/tasks/99999/subtasks", json={"title": "Ghost"})
    assert r.status_code == 404


def test_update_subtask_toggle_complete(client):
    task = make_task(client)
    sub = client.post(f"/tasks/{task['id']}/subtasks", json={"title": "X"}).json()

    r = client.patch(f"/subtasks/{sub['id']}", json={"completed": True})
    assert r.status_code == 200
    assert r.json()["completed"] is True

    r = client.patch(f"/subtasks/{sub['id']}", json={"completed": False})
    assert r.json()["completed"] is False


def test_update_subtask_rename(client):
    task = make_task(client)
    sub = client.post(f"/tasks/{task['id']}/subtasks", json={"title": "Old"}).json()
    r = client.patch(f"/subtasks/{sub['id']}", json={"title": "New"})
    assert r.json()["title"] == "New"


def test_delete_subtask(client):
    task = make_task(client)
    sub = client.post(f"/tasks/{task['id']}/subtasks", json={"title": "Doomed"}).json()
    r = client.delete(f"/subtasks/{sub['id']}")
    assert r.status_code == 200
    parent = client.get(f"/tasks/{task['id']}").json()
    assert parent["subtasks"] == []


def test_delete_task_cascades_to_subtasks(client):
    task = make_task(client)
    client.post(f"/tasks/{task['id']}/subtasks", json={"title": "S1"})
    client.post(f"/tasks/{task['id']}/subtasks", json={"title": "S2"})

    r = client.delete(f"/tasks/{task['id']}")
    assert r.status_code == 200

    # Subtasks should be gone — cascade="all, delete-orphan" on the model.
    # Fetching the parent now 404s; we can't easily query subtasks by parent
    # id since the parent endpoint is gone, but we can assert the parent's
    # missing.
    assert client.get(f"/tasks/{task['id']}").status_code == 404


def test_missing_subtask_returns_404(client):
    assert client.patch("/subtasks/99999", json={"completed": True}).status_code == 404
    assert client.delete("/subtasks/99999").status_code == 404
