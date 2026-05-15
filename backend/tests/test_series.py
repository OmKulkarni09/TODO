"""Cascade behavior + series delete endpoint.

A "series" = a chain of tasks linked by parent_task_id. These tests verify:
- Building a chain by repeated completion
- Deleting any node cascades to its descendants
- The /series endpoint nukes from any member by walking back to the root
- Edge cases: single-member series, deeply nested chains
"""
from datetime import datetime

from tests.conftest import make_task


def _build_chain(client, length: int, *, rule="daily", start=None):
    """Create a recurring task and complete it `length-1` times to build
    a chain of `length` tasks. Returns the list of task ids in creation
    order (root first, latest last)."""
    start = start or datetime(2026, 5, 15, 9, 0)
    t = make_task(client, title="ser", recurrence=rule, due_date=start.isoformat())
    chain = [t["id"]]
    for _ in range(length - 1):
        client.patch(f"/tasks/{chain[-1]}", json={"status": "completed"})
        all_tasks = client.get("/tasks").json()
        latest = max(
            (x for x in all_tasks if x["status"] == "pending"),
            key=lambda x: x["id"],
        )
        chain.append(latest["id"])
    return chain


# ---------- Cascade on delete --------------------------------------------

def test_delete_single_task_does_not_affect_others(client):
    a = make_task(client, title="A")
    b = make_task(client, title="B")
    client.delete(f"/tasks/{a['id']}")
    remaining = client.get("/tasks").json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == b["id"]


def test_delete_root_cascades_to_all_descendants(client):
    chain = _build_chain(client, length=4)
    assert len(client.get("/tasks").json()) == 4

    client.delete(f"/tasks/{chain[0]}")
    assert client.get("/tasks").json() == []


def test_delete_middle_cascades_only_to_below(client):
    """Deleting a node in the chain should drop everything spawned BELOW it,
    but leave its ancestors intact (they're not its descendants)."""
    chain = _build_chain(client, length=5)
    # chain[0] (root, completed) → chain[1] (completed) → chain[2] (completed)
    #   → chain[3] (completed) → chain[4] (pending leaf)
    assert len(client.get("/tasks").json()) == 5

    # Delete the middle (chain[2]) — its descendants (chain[3], chain[4]) go
    client.delete(f"/tasks/{chain[2]}")
    remaining_ids = sorted(t["id"] for t in client.get("/tasks").json())
    assert remaining_ids == sorted([chain[0], chain[1]])


def test_delete_leaf_only_removes_leaf(client):
    chain = _build_chain(client, length=3)
    client.delete(f"/tasks/{chain[-1]}")
    remaining_ids = sorted(t["id"] for t in client.get("/tasks").json())
    assert remaining_ids == sorted([chain[0], chain[1]])


# ---------- /tasks/{id}/series endpoint -----------------------------------

def test_series_delete_from_root(client):
    chain = _build_chain(client, length=4)
    r = client.delete(f"/tasks/{chain[0]}/series")
    assert r.status_code == 200
    assert client.get("/tasks").json() == []


def test_series_delete_from_middle(client):
    """Calling the series endpoint on ANY member should nuke the whole
    series. The backend walks back to the root and cascades."""
    chain = _build_chain(client, length=5)
    r = client.delete(f"/tasks/{chain[2]}/series")
    assert r.status_code == 200
    assert client.get("/tasks").json() == []


def test_series_delete_from_leaf(client):
    chain = _build_chain(client, length=4)
    r = client.delete(f"/tasks/{chain[-1]}/series")
    assert r.status_code == 200
    assert client.get("/tasks").json() == []


def test_series_delete_on_non_recurring_task(client):
    """A non-recurring task is a series of one. Series delete should still
    work — just removes the single task."""
    t = make_task(client)
    r = client.delete(f"/tasks/{t['id']}/series")
    assert r.status_code == 200
    assert client.get("/tasks").json() == []


def test_series_delete_missing_returns_404(client):
    assert client.delete("/tasks/99999/series").status_code == 404


def test_series_delete_does_not_affect_unrelated_tasks(client):
    """Two separate recurring series + a non-recurring task. Nuking series A
    must not touch series B or the standalone."""
    chain_a = _build_chain(client, length=3)
    chain_b = _build_chain(client, length=2, start=datetime(2026, 6, 1))
    standalone = make_task(client, title="lone")

    client.delete(f"/tasks/{chain_a[1]}/series")  # any member of A

    remaining = client.get("/tasks").json()
    remaining_ids = sorted(t["id"] for t in remaining)
    expected = sorted([*chain_b, standalone["id"]])
    assert remaining_ids == expected


# ---------- Parent / descendant integrity --------------------------------

def test_first_spawn_has_parent_pointing_to_completed_root(client):
    t = make_task(client, recurrence="daily", due_date=datetime(2026, 5, 15).isoformat())
    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    spawned = [x for x in client.get("/tasks").json() if x["id"] != t["id"]][0]
    assert spawned["parent_task_id"] == t["id"]


def test_chain_parent_links_are_correct(client):
    chain = _build_chain(client, length=4)
    tasks = {x["id"]: x for x in client.get("/tasks").json()}
    # Root has no parent
    assert tasks[chain[0]]["parent_task_id"] is None
    # Each subsequent task points to the previous
    for i in range(1, len(chain)):
        assert tasks[chain[i]]["parent_task_id"] == chain[i - 1]


def test_uncompleting_root_cascades_through_chain(client):
    """If user uncompletes the ROOT of a 4-deep chain, the entire downstream
    (3 spawned descendants) should be deleted."""
    chain = _build_chain(client, length=4)
    client.patch(f"/tasks/{chain[0]}", json={"status": "pending"})
    remaining = client.get("/tasks").json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == chain[0]
    assert remaining[0]["status"] == "pending"


def test_uncompleting_middle_drops_below(client):
    chain = _build_chain(client, length=5)
    # chain[2] is completed; uncomplete it
    client.patch(f"/tasks/{chain[2]}", json={"status": "pending"})
    remaining_ids = sorted(t["id"] for t in client.get("/tasks").json())
    # chain[0], chain[1] (still completed) + chain[2] (now pending). chain[3] & chain[4] gone.
    assert remaining_ids == sorted([chain[0], chain[1], chain[2]])
    states = {t["id"]: t["status"] for t in client.get("/tasks").json()}
    assert states[chain[2]] == "pending"
