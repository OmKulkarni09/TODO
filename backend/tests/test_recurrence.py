"""Recurrence math + spawn behavior.

These tests pin down the most business-critical logic in the app:
- `_next_due_date` for every rule including calendar edge cases
- spawn-on-completion only fires for valid setups
- spawn sets parent_task_id correctly
- the freshly spawned task inherits the right fields
"""
from datetime import datetime, timedelta

import pytest

from crud import _next_due_date
from tests.conftest import make_task, make_category


# ---------- Pure date math ------------------------------------------------

class TestNextDueDateDaily:
    def test_advance_one_day(self):
        assert _next_due_date("daily", datetime(2026, 5, 15, 9, 30)) == datetime(2026, 5, 16, 9, 30)

    def test_preserves_time_of_day(self):
        for hour in (0, 6, 12, 18, 23):
            d = datetime(2026, 5, 15, hour, 30, 45)
            n = _next_due_date("daily", d)
            assert n.hour == hour and n.minute == 30 and n.second == 45

    def test_crosses_month_boundary(self):
        assert _next_due_date("daily", datetime(2026, 1, 31)) == datetime(2026, 2, 1)

    def test_crosses_year_boundary(self):
        assert _next_due_date("daily", datetime(2026, 12, 31, 23, 59)) == datetime(2027, 1, 1, 23, 59)


class TestNextDueDateWeekdays:
    @pytest.mark.parametrize(
        "current,expected",
        [
            # Mon → Tue
            (datetime(2026, 5, 11), datetime(2026, 5, 12)),
            # Tue → Wed
            (datetime(2026, 5, 12), datetime(2026, 5, 13)),
            # Wed → Thu
            (datetime(2026, 5, 13), datetime(2026, 5, 14)),
            # Thu → Fri
            (datetime(2026, 5, 14), datetime(2026, 5, 15)),
            # Fri → SKIP Sat+Sun → Mon
            (datetime(2026, 5, 15), datetime(2026, 5, 18)),
            # Sat → SKIP Sun → Mon
            (datetime(2026, 5, 16), datetime(2026, 5, 18)),
            # Sun → Mon
            (datetime(2026, 5, 17), datetime(2026, 5, 18)),
        ],
    )
    def test_weekday_skipping(self, current, expected):
        assert _next_due_date("weekdays", current) == expected


class TestNextDueDateWeekly:
    def test_advance_seven_days(self):
        assert _next_due_date("weekly", datetime(2026, 5, 15)) == datetime(2026, 5, 22)

    def test_crosses_month(self):
        # May 29 + 7 = June 5
        assert _next_due_date("weekly", datetime(2026, 5, 29)) == datetime(2026, 6, 5)


class TestNextDueDateMonthly:
    def test_advance_one_month(self):
        assert _next_due_date("monthly", datetime(2026, 5, 15)) == datetime(2026, 6, 15)

    def test_crosses_year(self):
        assert _next_due_date("monthly", datetime(2026, 12, 15)) == datetime(2027, 1, 15)

    def test_jan_31_clamps_to_feb_28_nonleap(self):
        """2026 is NOT a leap year — Feb has 28 days, so Jan 31 → Feb 28."""
        assert _next_due_date("monthly", datetime(2026, 1, 31)) == datetime(2026, 2, 28)

    def test_jan_31_clamps_to_feb_29_leap(self):
        """2024 IS a leap year — Feb has 29 days, so Jan 31 → Feb 29."""
        assert _next_due_date("monthly", datetime(2024, 1, 31)) == datetime(2024, 2, 29)

    def test_mar_31_clamps_to_apr_30(self):
        """April has 30 days."""
        assert _next_due_date("monthly", datetime(2026, 3, 31)) == datetime(2026, 4, 30)

    def test_preserves_time(self):
        d = datetime(2026, 5, 15, 14, 30, 15)
        assert _next_due_date("monthly", d) == datetime(2026, 6, 15, 14, 30, 15)


class TestNextDueDateYearly:
    def test_advance_one_year(self):
        assert _next_due_date("yearly", datetime(2026, 5, 15)) == datetime(2027, 5, 15)

    def test_feb_29_leap_to_nonleap(self):
        """Feb 29 2024 (leap) → Feb 29 2025 doesn't exist → falls back to Feb 28."""
        assert _next_due_date("yearly", datetime(2024, 2, 29)) == datetime(2025, 2, 28)

    def test_feb_29_leap_to_leap(self):
        """Feb 29 2024 → Feb 29 2025? No, +1 year. Test next-leap separately:
        Feb 28 2024 → Feb 28 2025, fine."""
        assert _next_due_date("yearly", datetime(2024, 2, 28)) == datetime(2025, 2, 28)


class TestNextDueDateInvalid:
    def test_none_rule(self):
        assert _next_due_date(None, datetime(2026, 5, 15)) is None

    def test_empty_rule(self):
        assert _next_due_date("", datetime(2026, 5, 15)) is None

    def test_unknown_rule(self):
        assert _next_due_date("hourly", datetime(2026, 5, 15)) is None

    def test_none_current(self):
        assert _next_due_date("daily", None) is None


# ---------- Spawn behavior through the API --------------------------------

class TestSpawnOnCompletion:
    def test_spawns_when_recurring_with_due_date(self, client):
        due = datetime(2026, 5, 15, 9, 0).isoformat()
        t = make_task(client, title="daily standup", recurrence="daily", due_date=due)

        client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
        all_tasks = client.get("/tasks").json()
        assert len(all_tasks) == 2

        spawned = [x for x in all_tasks if x["id"] != t["id"]][0]
        assert spawned["title"] == "daily standup"
        assert spawned["recurrence"] == "daily"
        assert spawned["status"] == "pending"
        assert spawned["parent_task_id"] == t["id"]
        assert datetime.fromisoformat(spawned["due_date"]) == datetime(2026, 5, 16, 9, 0)

    def test_does_not_spawn_without_recurrence(self, client):
        t = make_task(client, due_date=datetime(2026, 5, 15).isoformat())
        client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
        assert len(client.get("/tasks").json()) == 1

    def test_does_not_spawn_without_due_date(self, client):
        t = make_task(client, recurrence="weekly")
        client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
        assert len(client.get("/tasks").json()) == 1

    def test_does_not_spawn_on_unchanged_status(self, client):
        t = make_task(client, recurrence="weekly", due_date=datetime(2026, 5, 15).isoformat())
        # Updating title without changing status — no spawn
        client.patch(f"/tasks/{t['id']}", json={"title": "renamed"})
        assert len(client.get("/tasks").json()) == 1

    def test_does_not_spawn_on_status_pending_to_pending(self, client):
        t = make_task(client, recurrence="weekly", due_date=datetime(2026, 5, 15).isoformat())
        # Explicitly set status=pending on a pending task — no transition
        client.patch(f"/tasks/{t['id']}", json={"status": "pending"})
        assert len(client.get("/tasks").json()) == 1

    def test_spawned_task_inherits_priority_and_category(self, client):
        cat = make_category(client, name="Work")
        t = make_task(
            client,
            title="rec",
            priority="urgent",
            recurrence="weekly",
            category_id=cat["id"],
            is_starred=True,
            due_date=datetime(2026, 5, 15).isoformat(),
        )
        client.patch(f"/tasks/{t['id']}", json={"status": "completed"})

        spawned = [x for x in client.get("/tasks").json() if x["id"] != t["id"]][0]
        assert spawned["priority"] == "urgent"
        assert spawned["category_id"] == cat["id"]
        assert spawned["is_starred"] is True
        assert spawned["recurrence"] == "weekly"

    def test_spawned_task_does_not_inherit_subtasks(self, client):
        """v1 design: subtasks are NOT replicated on recurring spawns."""
        t = client.post(
            "/tasks",
            json={
                "title": "rec",
                "recurrence": "daily",
                "due_date": datetime(2026, 5, 15).isoformat(),
                "subtasks": [{"title": "S1"}, {"title": "S2"}],
            },
        ).json()
        client.patch(f"/tasks/{t['id']}", json={"status": "completed"})

        spawned = [x for x in client.get("/tasks").json() if x["id"] != t["id"]][0]
        assert spawned["subtasks"] == []

    def test_anchor_uses_due_date_not_completion_time(self, client):
        """Critical: if you complete Mon's 9am standup late at 2pm, Tuesday's
        is still due Tue 9am — anchored to the original schedule, not the
        completion timestamp."""
        due = datetime(2026, 5, 11, 9, 0).isoformat()  # a Monday
        t = make_task(client, recurrence="weekdays", due_date=due)
        client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
        spawned = [x for x in client.get("/tasks").json() if x["id"] != t["id"]][0]
        # Tuesday May 12 9am — NOT today + 1 day
        assert datetime.fromisoformat(spawned["due_date"]) == datetime(2026, 5, 12, 9, 0)


class TestNoDuplicateSpawn:
    """The bug we fixed: complete → uncomplete → complete must NOT spawn twice."""

    def test_re_completing_does_not_spawn_duplicate(self, client):
        t = make_task(client, recurrence="daily", due_date=datetime(2026, 5, 15).isoformat())
        client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
        assert len(client.get("/tasks").json()) == 2

        # Uncomplete — descendants should go
        client.patch(f"/tasks/{t['id']}", json={"status": "pending"})
        assert len(client.get("/tasks").json()) == 1

        # Re-complete — exactly one spawn, not two
        client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
        assert len(client.get("/tasks").json()) == 2

    def test_uncomplete_deletes_spawned_successor(self, client):
        t = make_task(client, recurrence="weekly", due_date=datetime(2026, 5, 15).isoformat())
        client.patch(f"/tasks/{t['id']}", json={"status": "completed"})
        assert len(client.get("/tasks").json()) == 2

        client.patch(f"/tasks/{t['id']}", json={"status": "pending"})
        remaining = client.get("/tasks").json()
        assert len(remaining) == 1
        assert remaining[0]["id"] == t["id"]
        assert remaining[0]["status"] == "pending"
