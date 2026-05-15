"""End-to-end workflow tests — multi-step user journeys hitting the API as
the React app would. If anything in the integration drifts, these are the
canaries.
"""
from datetime import datetime, timedelta


def test_full_workflow_first_time_user(client):
    """A user opens the app for the first time and:
    1) sees no categories or tasks
    2) creates a category
    3) creates a task with that category
    4) marks it complete
    5) sees stats reflect the completion
    """
    assert client.get("/categories").json() == []
    assert client.get("/tasks").json() == []
    assert client.get("/stats").json()["total"] == 0

    cat = client.post("/categories", json={"name": "Work", "color": "#06b6d4"}).json()
    assert cat["id"] > 0

    task = client.post(
        "/tasks",
        json={"title": "First task", "priority": "high", "category_id": cat["id"]},
    ).json()
    assert task["category"]["name"] == "Work"

    stats = client.get("/stats").json()
    assert stats["total"] == 1
    assert stats["pending"] == 1
    assert stats["completed"] == 0

    client.patch(f"/tasks/{task['id']}", json={"status": "completed"})

    stats = client.get("/stats").json()
    assert stats["completed"] == 1
    assert stats["pending"] == 0
    assert stats["completion_rate"] == 100.0


def test_recurring_workflow_three_completions(client):
    """User creates a daily recurring task and completes it three times
    (e.g. three days of standup). Verify chain integrity each step."""
    due = datetime(2026, 5, 11, 9, 0).isoformat()
    root = client.post(
        "/tasks",
        json={"title": "standup", "priority": "medium", "recurrence": "daily", "due_date": due},
    ).json()

    # Day 1: complete root
    client.patch(f"/tasks/{root['id']}", json={"status": "completed"})
    tasks = client.get("/tasks").json()
    assert len(tasks) == 2
    spawn1 = next(t for t in tasks if t["status"] == "pending")
    assert spawn1["parent_task_id"] == root["id"]

    # Day 2: complete the first spawn
    client.patch(f"/tasks/{spawn1['id']}", json={"status": "completed"})
    tasks = client.get("/tasks").json()
    assert len(tasks) == 3
    spawn2 = next(t for t in tasks if t["status"] == "pending")
    assert spawn2["parent_task_id"] == spawn1["id"]

    # Day 3: complete the second spawn
    client.patch(f"/tasks/{spawn2['id']}", json={"status": "completed"})
    tasks = client.get("/tasks").json()
    assert len(tasks) == 4
    completed_count = sum(1 for t in tasks if t["status"] == "completed")
    pending_count = sum(1 for t in tasks if t["status"] == "pending")
    assert completed_count == 3
    assert pending_count == 1

    # Final cleanup: series delete from any member should nuke all 4
    client.delete(f"/tasks/{spawn1['id']}/series")
    assert client.get("/tasks").json() == []


def test_user_changes_mind_workflow(client):
    """User completes a task, regrets it, uncompletes, then deletes.
    Tests the un-completion + cascade flow we fixed.
    """
    task = client.post(
        "/tasks",
        json={
            "title": "Try recurring",
            "recurrence": "weekly",
            "due_date": datetime(2026, 5, 15).isoformat(),
        },
    ).json()

    # Complete → spawn appears
    client.patch(f"/tasks/{task['id']}", json={"status": "completed"})
    assert len(client.get("/tasks").json()) == 2

    # Uncomplete → spawn should disappear, only the original remains pending
    client.patch(f"/tasks/{task['id']}", json={"status": "pending"})
    remaining = client.get("/tasks").json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == task["id"]
    assert remaining[0]["status"] == "pending"

    # Delete → fully gone
    client.delete(f"/tasks/{task['id']}")
    assert client.get("/tasks").json() == []
    assert client.get("/stats").json()["total"] == 0


def test_subtask_workflow(client):
    """Create a task with subtasks, toggle some, add one, delete one."""
    task = client.post(
        "/tasks",
        json={
            "title": "Pack for trip",
            "subtasks": [{"title": "passport"}, {"title": "charger"}],
        },
    ).json()
    assert len(task["subtasks"]) == 2

    # Toggle one complete
    s1 = task["subtasks"][0]
    client.patch(f"/subtasks/{s1['id']}", json={"completed": True})

    # Add another
    s3 = client.post(
        f"/tasks/{task['id']}/subtasks", json={"title": "snacks"}
    ).json()
    assert s3["title"] == "snacks"

    fetched = client.get(f"/tasks/{task['id']}").json()
    assert len(fetched["subtasks"]) == 3
    done = [s for s in fetched["subtasks"] if s["completed"]]
    assert len(done) == 1

    # Delete one
    client.delete(f"/subtasks/{s3['id']}")
    fetched = client.get(f"/tasks/{task['id']}").json()
    assert len(fetched["subtasks"]) == 2


def test_filter_combinations(client):
    """Verify that filters compose correctly when multiple are applied."""
    cat = client.post("/categories", json={"name": "W"}).json()
    now = datetime.utcnow()
    matches = client.post(
        "/tasks",
        json={
            "title": "match me",
            "priority": "high",
            "category_id": cat["id"],
            "due_date": (now - timedelta(days=2)).isoformat(),
        },
    ).json()
    # Decoys with various non-matching attributes
    client.post(
        "/tasks",
        json={
            "title": "wrong priority",
            "priority": "low",
            "category_id": cat["id"],
            "due_date": (now - timedelta(days=2)).isoformat(),
        },
    )
    client.post(
        "/tasks",
        json={
            "title": "wrong category",
            "priority": "high",
            "due_date": (now - timedelta(days=2)).isoformat(),
        },
    )
    client.post(
        "/tasks",
        json={
            "title": "not overdue",
            "priority": "high",
            "category_id": cat["id"],
            "due_date": (now + timedelta(days=2)).isoformat(),
        },
    )

    res = client.get(
        f"/tasks?view=overdue&priority=high&category_id={cat['id']}"
    ).json()
    assert len(res) == 1
    assert res[0]["id"] == matches["id"]


def test_edit_recurring_rule_mid_series(client):
    """User starts a daily recurring task, completes once, then realizes
    daily is too much and edits it to weekly. The current task's rule
    updates; the already-spawned successor keeps its inherited 'daily'
    rule, but future spawns from this point use 'weekly'.

    This is correct behavior: each spawn snapshots the rule at the moment
    of spawn. Changing the parent's rule after the fact only affects the
    parent's own behavior going forward (but it has descendants so it
    won't spawn again anyway).
    """
    t = client.post(
        "/tasks",
        json={
            "title": "rate test",
            "recurrence": "daily",
            "due_date": datetime(2026, 5, 15).isoformat(),
        },
    ).json()

    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    tasks = client.get("/tasks").json()
    spawn = next(x for x in tasks if x["status"] == "pending")
    assert spawn["recurrence"] == "daily"

    # Now change the spawned task's rule to weekly. Complete it.
    client.patch(f"/tasks/{spawn['id']}", json={"recurrence": "weekly"})
    client.patch(f"/tasks/{spawn['id']}", json={"status": "completed"})

    tasks = client.get("/tasks").json()
    new_spawn = next(x for x in tasks if x["status"] == "pending")
    assert new_spawn["recurrence"] == "weekly"
    # weekly from May 16 = May 23
    assert datetime.fromisoformat(new_spawn["due_date"]) == datetime(2026, 5, 23)


def test_stress_many_tasks(client):
    """Smoke test the API doesn't choke on a moderately large list."""
    for i in range(50):
        client.post("/tasks", json={"title": f"task {i}", "priority": "low"})
    res = client.get("/tasks").json()
    assert len(res) == 50
    stats = client.get("/stats").json()
    assert stats["total"] == 50
    assert stats["pending"] == 50
