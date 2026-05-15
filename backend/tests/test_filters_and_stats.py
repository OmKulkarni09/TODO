"""View filters (today/upcoming/overdue/starred/completed) + stats endpoint.

These tests use freeze-style timing — they pick due dates relative to *real*
`datetime.utcnow()` so the backend's view filters classify them correctly
without us mocking time.
"""
from datetime import datetime, timedelta

from tests.conftest import make_task, make_category


# ---------- View filters --------------------------------------------------

def test_view_today_returns_tasks_due_today_only(client):
    now = datetime.utcnow()
    today = make_task(client, title="today", due_date=now.isoformat())
    make_task(client, title="tomorrow", due_date=(now + timedelta(days=1)).isoformat())
    make_task(client, title="yesterday", due_date=(now - timedelta(days=1)).isoformat())
    make_task(client, title="no-date")

    titles = {t["title"] for t in client.get("/tasks?view=today").json()}
    assert titles == {"today"}


def test_view_today_excludes_completed_today_tasks(client):
    now = datetime.utcnow()
    t = make_task(client, due_date=now.isoformat())
    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    assert client.get("/tasks?view=today").json() == []


def test_view_upcoming_returns_future_only(client):
    now = datetime.utcnow()
    make_task(client, title="today", due_date=now.isoformat())
    future = make_task(
        client, title="future", due_date=(now + timedelta(days=3)).isoformat()
    )
    make_task(client, title="past", due_date=(now - timedelta(days=3)).isoformat())

    titles = {t["title"] for t in client.get("/tasks?view=upcoming").json()}
    # "upcoming" is strictly after end-of-today
    assert titles == {"future"}
    assert future["id"] in {t["id"] for t in client.get("/tasks?view=upcoming").json()}


def test_view_overdue_returns_past_pending_only(client):
    now = datetime.utcnow()
    overdue = make_task(client, title="overdue", due_date=(now - timedelta(days=2)).isoformat())
    make_task(client, title="future", due_date=(now + timedelta(days=2)).isoformat())

    titles = {t["title"] for t in client.get("/tasks?view=overdue").json()}
    assert titles == {"overdue"}


def test_view_overdue_excludes_completed_past_tasks(client):
    """A task overdue but already completed should NOT appear in 'overdue'."""
    now = datetime.utcnow()
    t = make_task(client, due_date=(now - timedelta(days=2)).isoformat())
    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    assert client.get("/tasks?view=overdue").json() == []


def test_view_starred(client):
    starred = make_task(client, title="starred", is_starred=True)
    make_task(client, title="not-starred")
    res = client.get("/tasks?view=starred").json()
    assert len(res) == 1
    assert res[0]["title"] == "starred"


def test_view_completed(client):
    t = make_task(client, title="done")
    make_task(client, title="pending")
    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    res = client.get("/tasks?view=completed").json()
    assert len(res) == 1
    assert res[0]["title"] == "done"


# ---------- Generic filters -----------------------------------------------

def test_filter_priority(client):
    make_task(client, title="u", priority="urgent")
    make_task(client, title="h", priority="high")
    make_task(client, title="m", priority="medium")
    titles = {t["title"] for t in client.get("/tasks?priority=high").json()}
    assert titles == {"h"}


def test_filter_status(client):
    a = make_task(client, title="a")
    make_task(client, title="b")
    client.patch(f"/tasks/{a['id']}", json={"status": "completed"})
    pending_titles = {t["title"] for t in client.get("/tasks?status=pending").json()}
    completed_titles = {t["title"] for t in client.get("/tasks?status=completed").json()}
    assert pending_titles == {"b"}
    assert completed_titles == {"a"}


def test_filter_category(client):
    a = make_category(client, name="A")
    b = make_category(client, name="B")
    make_task(client, title="ta", category_id=a["id"])
    make_task(client, title="tb", category_id=b["id"])
    make_task(client, title="none")
    titles = {t["title"] for t in client.get(f"/tasks?category_id={a['id']}").json()}
    assert titles == {"ta"}


def test_search_title(client):
    make_task(client, title="Read book about React")
    make_task(client, title="Buy groceries")
    titles = {t["title"] for t in client.get("/tasks?search=react").json()}
    assert titles == {"Read book about React"}


def test_search_description(client):
    make_task(client, title="A", description="cabbage and onions")
    make_task(client, title="B", description="rice")
    titles = {t["title"] for t in client.get("/tasks?search=onions").json()}
    assert titles == {"A"}


def test_search_case_insensitive(client):
    make_task(client, title="Important Meeting")
    titles = {t["title"] for t in client.get("/tasks?search=IMPORTANT").json()}
    assert titles == {"Important Meeting"}


# ---------- Stats endpoint -----------------------------------------------

def test_stats_zero_state(client):
    s = client.get("/stats").json()
    assert s["total"] == 0
    assert s["completed"] == 0
    assert s["pending"] == 0
    assert s["overdue"] == 0
    assert s["due_today"] == 0
    assert s["completion_rate"] == 0.0
    assert s["by_priority"] == {"low": 0, "medium": 0, "high": 0, "urgent": 0}


def test_stats_basic_counts(client):
    now = datetime.utcnow()
    make_task(client, priority="urgent", due_date=now.isoformat())
    make_task(client, priority="high")
    t = make_task(client, priority="low")
    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})

    s = client.get("/stats").json()
    assert s["total"] == 3
    assert s["pending"] == 2
    assert s["completed"] == 1
    assert s["due_today"] == 1
    assert s["completion_rate"] == round(1 / 3 * 100, 1)
    assert s["by_priority"]["urgent"] == 1
    assert s["by_priority"]["high"] == 1
    assert s["by_priority"]["low"] == 1


def test_stats_overdue_counts_past_pending_only(client):
    now = datetime.utcnow()
    # past pending → overdue
    make_task(client, due_date=(now - timedelta(days=3)).isoformat())
    # past completed → not overdue
    t = make_task(client, due_date=(now - timedelta(days=3)).isoformat())
    client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
    # future pending → not overdue
    make_task(client, due_date=(now + timedelta(days=3)).isoformat())

    s = client.get("/stats").json()
    assert s["overdue"] == 1


def test_stats_completion_rate_precision(client):
    """Completion rate rounds to one decimal place."""
    a = make_task(client)
    make_task(client)
    make_task(client)
    client.patch(f"/tasks/{a['id']}", json={"status": "completed"})
    s = client.get("/stats").json()
    # 1/3 = 33.3333... → 33.3
    assert s["completion_rate"] == 33.3


def test_stats_by_category(client):
    work = make_category(client, name="Work")
    home = make_category(client, name="Home")
    make_task(client, category_id=work["id"])
    make_task(client, category_id=work["id"])
    make_task(client, category_id=home["id"])

    s = client.get("/stats").json()
    by_cat = {c["name"]: c["count"] for c in s["by_category"]}
    assert by_cat["Work"] == 2
    assert by_cat["Home"] == 1


def test_stats_seven_day_chart_has_seven_entries(client):
    s = client.get("/stats").json()
    assert len(s["completed_last_7_days"]) == 7
    # Last entry corresponds to today
    days = [d["date"] for d in s["completed_last_7_days"]]
    # All entries are short day-of-week labels
    assert all(len(d) == 3 for d in days)
