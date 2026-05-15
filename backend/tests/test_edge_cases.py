"""Targeted edge-case tests — designed to break what looked safe.

These tests cover scenarios that aren't part of normal happy-path workflows
but could happen with quirky users, race conditions, weird input, or future
refactors.
"""
from datetime import datetime, timedelta

import pytest

from tests.conftest import make_task, make_category


# ---------- Recurrence interaction edge cases -----------------------------

def test_spawn_uses_pre_update_recurrence_when_changed_inline(client):
    """When user sends `recurrence` and `status: completed` in ONE PATCH,
    the spawn uses the PRE-update rule. This is intentional: the comment
    in crud.update_task says 'so even if the user changes the rule +
    completes in the same call we use the prior schedule.'"""
    t = make_task(client, recurrence="daily", due_date=datetime(2026, 5, 15, 9).isoformat())
    client.patch(
        f"/tasks/{t['id']}",
        json={"recurrence": None, "status": "completed"},
    )
    # Old rule = daily → spawn happens
    assert len(client.get("/tasks").json()) == 2


def test_no_spawn_after_separate_recurrence_removal(client):
    """If user wants to skip spawning, they should remove the rule in a
    separate PATCH before completing."""
    t = make_task(client, recurrence="daily", due_date=datetime(2026, 5, 15, 9).isoformat())
    client.patch(f"/tasks/{t['id']}", json={"recurrence": None})
    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    assert len(client.get("/tasks").json()) == 1


def test_add_recurrence_to_completed_then_uncomplete_complete(client):
    """User completes a non-recurring task, regrets it, edits to add
    recurrence, uncompletes and re-completes — should spawn exactly once."""
    t = make_task(client, due_date=datetime(2026, 5, 15, 9).isoformat())
    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    assert len(client.get("/tasks").json()) == 1

    client.patch(f"/tasks/{t['id']}", json={"recurrence": "weekly"})
    client.patch(f"/tasks/{t['id']}", json={"status": "pending"})
    assert len(client.get("/tasks").json()) == 1  # no descendants to delete

    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    # Now recurrence + due_date set → spawn happens
    assert len(client.get("/tasks").json()) == 2


def test_uncomplete_already_pending_is_noop(client):
    """PATCHing pending → pending shouldn't change completed_at or spawn."""
    t = make_task(client, recurrence="daily", due_date=datetime(2026, 5, 15).isoformat())
    client.patch(f"/tasks/{t['id']}", json={"status": "pending"})
    assert len(client.get("/tasks").json()) == 1
    refetched = client.get(f"/tasks/{t['id']}").json()
    assert refetched["completed_at"] is None


# ---------- Title / description edge cases --------------------------------

def test_unicode_title(client):
    title = "🚀 Ship Q1 — résumé café naïve 中文 العربية"
    t = make_task(client, title=title)
    assert t["title"] == title
    assert client.get(f"/tasks/{t['id']}").json()["title"] == title


def test_very_long_title(client):
    long_title = "x" * 5000
    t = make_task(client, title=long_title)
    assert len(t["title"]) == 5000


def test_very_long_description(client):
    long_desc = "lorem ipsum " * 2000
    t = make_task(client, title="ok", description=long_desc)
    assert t["description"] == long_desc


def test_empty_description_is_empty_string_not_null(client):
    t = make_task(client)
    assert t["description"] == ""


def test_search_with_special_characters(client):
    make_task(client, title="meet w/ %client% 100%")
    res = client.get("/tasks", params={"search": "%client%"}).json()
    assert len(res) == 1


def test_search_no_results(client):
    make_task(client, title="hello world")
    res = client.get("/tasks", params={"search": "nope"}).json()
    assert res == []


# ---------- Foreign key behavior ------------------------------------------

def test_invalid_category_id_silently_orphans(client):
    """The backend doesn't enforce FK existence at create-time on SQLite
    by default. We accept the id; the join just returns null. Test
    documents current behavior (could be tightened later)."""
    r = client.post("/tasks", json={"title": "X", "category_id": 99999})
    assert r.status_code == 200
    t = r.json()
    assert t["category_id"] == 99999
    assert t["category"] is None


def test_updating_category_to_invalid_id(client):
    t = make_task(client)
    r = client.patch(f"/tasks/{t['id']}", json={"category_id": 99999})
    assert r.status_code == 200


# ---------- Time math edge cases ------------------------------------------

def test_due_date_in_far_past_creates_overdue(client):
    far_past = (datetime.utcnow() - timedelta(days=365 * 5)).isoformat()
    t = make_task(client, due_date=far_past)
    overdue = client.get("/tasks?view=overdue").json()
    assert any(x["id"] == t["id"] for x in overdue)


def test_due_date_in_far_future(client):
    """Should appear in upcoming view, not overdue."""
    far_future = (datetime.utcnow() + timedelta(days=365 * 5)).isoformat()
    t = make_task(client, due_date=far_future)
    assert any(x["id"] == t["id"] for x in client.get("/tasks?view=upcoming").json())
    assert not any(x["id"] == t["id"] for x in client.get("/tasks?view=overdue").json())


def test_recurring_overdue_task_completion_still_spawns(client):
    """If you complete an OVERDUE recurring task today, the next spawn is
    anchored to the (overdue) due_date — not today."""
    overdue = datetime(2020, 1, 1, 9, 0)
    t = make_task(client, recurrence="weekly", due_date=overdue.isoformat())
    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    spawned = [x for x in client.get("/tasks").json() if x["id"] != t["id"]][0]
    expected = datetime(2020, 1, 8, 9, 0)
    assert datetime.fromisoformat(spawned["due_date"]) == expected


# ---------- Rapid-fire operations -----------------------------------------

def test_complete_uncomplete_complete_uncomplete_idempotent(client):
    """Bounce status repeatedly. Final state should be deterministic
    and not leave duplicate spawns floating around."""
    t = make_task(client, recurrence="daily", due_date=datetime(2026, 5, 15).isoformat())
    for _ in range(5):
        client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
        client.patch(f"/tasks/{t['id']}", json={"status": "pending"})

    # Final state: pending (last action), 0 descendants
    final = client.get("/tasks").json()
    assert len(final) == 1
    assert final[0]["status"] == "pending"


def test_many_completes_creates_deep_chain(client):
    """Burn through 20 generations to test the chain doesn't degrade
    (e.g. parent_task_id wraps wrong, or stack overflow on cascade)."""
    t = make_task(client, recurrence="daily", due_date=datetime(2026, 5, 1).isoformat())
    current_id = t["id"]
    for _ in range(20):
        client.patch(f"/tasks/{current_id}", json={"status": "completed"})
        tasks = client.get("/tasks").json()
        current = next(x for x in tasks if x["status"] == "pending")
        current_id = current["id"]

    all_tasks = client.get("/tasks").json()
    assert len(all_tasks) == 21  # original + 20 spawns

    # Series delete from the leaf should nuke all 21
    client.delete(f"/tasks/{current_id}/series")
    assert client.get("/tasks").json() == []


# ---------- Subtask edge cases --------------------------------------------

def test_create_task_with_empty_subtasks_array(client):
    r = client.post("/tasks", json={"title": "no subs", "subtasks": []})
    assert r.status_code == 200
    assert r.json()["subtasks"] == []


def test_subtask_completion_does_not_complete_parent(client):
    """Completing all subtasks does not auto-complete the parent task —
    that's an intentional design choice (subtasks are notes, not gates)."""
    task = make_task(client)
    s1 = client.post(f"/tasks/{task['id']}/subtasks", json={"title": "A"}).json()
    s2 = client.post(f"/tasks/{task['id']}/subtasks", json={"title": "B"}).json()
    client.patch(f"/subtasks/{s1['id']}", json={"completed": True})
    client.patch(f"/subtasks/{s2['id']}", json={"completed": True})
    assert client.get(f"/tasks/{task['id']}").json()["status"] == "pending"


# ---------- Stats correctness under churn ---------------------------------

def test_stats_accurate_after_recurring_churn(client):
    """Series completions create real tasks (one per occurrence). Verify
    stats reflect the actual task count after several completions."""
    t = make_task(client, recurrence="daily", due_date=datetime(2026, 5, 1).isoformat())
    current = t["id"]
    for _ in range(3):
        client.patch(f"/tasks/{current}", json={"status": "completed"})
        current = next(
            x["id"]
            for x in client.get("/tasks").json()
            if x["status"] == "pending"
        )

    s = client.get("/stats").json()
    # 4 total tasks: 3 completed + 1 pending leaf
    assert s["total"] == 4
    assert s["completed"] == 3
    assert s["pending"] == 1


# ---------- Series delete edge cases --------------------------------------

def test_series_delete_with_no_children(client):
    """Series delete on a singleton (no recurrence, no descendants)."""
    t = make_task(client)
    client.delete(f"/tasks/{t['id']}/series")
    assert client.get("/tasks").json() == []


def test_series_delete_with_pending_and_completed_mix(client):
    """A series with 2 completed + 1 pending — series delete removes all."""
    t = make_task(client, recurrence="daily", due_date=datetime(2026, 5, 1).isoformat())
    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    second = next(x for x in client.get("/tasks").json() if x["status"] == "pending")
    client.patch(f"/tasks/{second['id']}", json={"status": "completed"})
    assert len(client.get("/tasks").json()) == 3

    client.delete(f"/tasks/{t['id']}/series")
    assert client.get("/tasks").json() == []
