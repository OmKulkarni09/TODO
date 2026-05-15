# Testing

**193 automated tests** across backend and frontend. Run them in seconds before any change.

## Quick start

```powershell
# Backend (133 tests)
cd backend
.\.venv\Scripts\python.exe -m pytest

# Frontend (60 tests)
cd frontend
npm test

# Frontend in watch mode (re-runs on save)
npm run test:watch
```

Both suites should report **all green** in under 5 seconds each. Any failure is a real bug.

---

## What's covered

### Backend (pytest, 133 tests)

| File | Tests | Surface |
|---|---|---|
| `tests/test_categories.py` | 10 | Category CRUD; deleting a category nulls `category_id` on tasks instead of cascading |
| `tests/test_subtasks.py` | 8 | Subtask CRUD; inline creation; cascade-delete with parent |
| `tests/test_tasks_crud.py` | 17 | Task CRUD; required-field validation; partial updates; status transitions; `completed_at` correctness |
| `tests/test_recurrence.py` | 40 | The `_next_due_date` math (daily / weekdays / weekly / monthly / yearly) + spawn-on-completion + no-duplicate-spawn |
| `tests/test_series.py` | 14 | `parent_task_id` chain integrity; cascade delete; the `/tasks/{id}/series` endpoint |
| `tests/test_filters_and_stats.py` | 17 | Every view filter (today / upcoming / overdue / starred / completed) + priority/category/search filters + stats endpoint accuracy |
| `tests/test_e2e_workflow.py` | 7 | Multi-step user journeys (create → complete → recur → uncomplete → delete) |
| `tests/test_edge_cases.py` | 22 | Unicode titles, very long fields, far-future dates, deep chains (20 generations), rapid bounce of status, mid-series rule changes |

### Frontend (Vitest, 60 tests)

| File | Tests | Surface |
|---|---|---|
| `src/utils/series.test.js` | 12 | `getSeriesRootId` walks parent chains; `groupBySeries` collapses occurrences into one representative with count; missing-parent fallback; cycle safety; non-mutation guarantee |
| `src/components/TaskItem.test.jsx` | 17 | Renders title/description/chips, priority/category/recurrence/series-count chips, date-chip formatting (Today/Tomorrow/Day/MMM d), line-through on completed, tick/star/edit/delete button handlers, subtask expansion + Enter-to-add |
| `src/components/Calendar.test.jsx` | 18 | Month label & day-of-week header rendering, 42-cell grid count, Prev/Next/Today/Tomorrow navigation (including December→January wraparound), day-cell click updates detail panel, real-task badge counts, **stats counters exclude projections** (anti-regression), projection rendering for recurring tasks |
| `src/components/ConfirmProvider.test.jsx` | 13 | `useConfirm` throws outside provider; default Cancel/Confirm flow; custom action values; series-delete 3-button shape; Escape/backdrop/`×` icon all resolve `null`; soft-button autofocus (Enter is safe); body-click does NOT dismiss; dialog disappears after action; sequential confirms resolve independently |

---

## Calendar-edge-case coverage worth calling out

These are the tests most likely to catch a regression in the trickiest logic:

| Behavior | Test |
|---|---|
| Jan 31 + 1 month → **Feb 28** in non-leap year | `test_jan_31_clamps_to_feb_28_nonleap` |
| Jan 31 + 1 month → **Feb 29** in leap year | `test_jan_31_clamps_to_feb_29_leap` |
| Mar 31 + 1 month → **Apr 30** (April has 30) | `test_mar_31_clamps_to_apr_30` |
| Feb 29 + 1 year → **Feb 28** next year | `test_feb_29_leap_to_nonleap` |
| Friday + 1 weekday → **Monday** (skip Sat/Sun) | `test_weekday_skipping` (parametrized × 7) |
| Re-completing recurring task does **NOT** spawn duplicate | `test_re_completing_does_not_spawn_duplicate` |
| Uncomplete recurring → spawned successor deleted | `test_uncomplete_deletes_spawned_successor` |
| Series delete from middle/leaf walks to root then cascades | `test_series_delete_from_middle` / `test_series_delete_from_leaf` |
| Recurring overdue task completion anchors to **due_date, not completion time** | `test_anchor_uses_due_date_not_completion_time` |
| Rapid complete/uncomplete bounce stays deterministic | `test_complete_uncomplete_complete_uncomplete_idempotent` |
| 20-generation chain → series delete from leaf removes all 21 | `test_many_completes_creates_deep_chain` |
| Subtasks are **NOT** replicated on recurring spawn (v1 design) | `test_spawned_task_does_not_inherit_subtasks` |

---

## How the test infrastructure works

### Backend

Each test gets a **brand-new in-memory SQLite database**, wired in via FastAPI's `dependency_overrides`. Tests:

- Never touch the real `todos.db`
- Run in milliseconds (no disk I/O)
- Are fully isolated from each other (no leaked state)

The fixture lives in `backend/tests/conftest.py`. The key trick is `poolclass=StaticPool` on the SQLite engine so a single in-memory connection is shared across the entire test, while remaining isolated from other tests.

```python
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
```

`client` fixture overrides `get_db` so every API call inside a test hits the isolated engine.

A `factory` fixture gives a tiny builder API (`factory.task(...)`, `factory.category(...)`) — but most tests use the explicit `make_task(client, ...)` / `make_category(client, ...)` helpers for clarity.

### Frontend

Vitest with **jsdom** environment (configured in `vitest.config.js`) so component tests can render React + use `@testing-library/react`. Pure-logic tests (like `series.test.js`) also run inside the same setup but don't touch the DOM. Tests live next to their source files (`Calendar.test.jsx` sits beside `Calendar.jsx`).

**Date determinism** — Component tests that depend on "today" use Vitest's `vi.useFakeTimers({ shouldAdvanceTime: true })` + `vi.setSystemTime(...)` to pin `new Date()` to a known value (`May 15, 2026` for most tests). `shouldAdvanceTime: true` lets real timers continue to work so user-event interactions don't hang. The fake-timer state is teared down in `afterEach`.

**Cleanup** — `vitest.setup.js` imports `@testing-library/jest-dom/vitest` for matchers like `toBeInTheDocument()`/`toHaveFocus()` and registers an `afterEach(cleanup)` so each test starts with a fresh DOM (no leaked nodes between tests).

**Disambiguation patterns** used in component tests:
- The day-detail eyebrow says "Today" *and* there's a navigation button labeled "Today" — tests use `getByRole('button', { name: 'Today' })` to target the button specifically
- Day cells contain numbers like "15" that could collide with stat-tile values — tests scope queries with `within(tile)` or use `getByRole('heading', ...)` for the unique date heading

---

## Adding new tests

**Backend (pytest)** — drop a new `test_*.py` into `backend/tests/`. Each test function takes `client` (and optionally `factory`, `db_session`, `now`, etc.) as parameters; pytest wires the fixtures automatically.

```python
def test_my_thing(client):
    r = client.post("/tasks", json={"title": "x"})
    assert r.status_code == 200
```

**Frontend (vitest)** — drop a `*.test.js` next to your source. Vitest auto-discovers.

```js
import { describe, it, expect } from 'vitest'
import { myFn } from './my-module.js'

describe('myFn', () => {
  it('does the thing', () => {
    expect(myFn(1)).toBe(2)
  })
})
```

---

## CI hook idea

If you ever wire this to GitHub Actions, the workflow is two parallel jobs:

```yaml
- name: Backend
  run: |
    cd backend
    pip install -r requirements.txt -r requirements-test.txt
    pytest
- name: Frontend
  run: |
    cd frontend
    npm ci
    npm test
```

Both suites are deterministic and don't need any services running (no DB, no live API, no browser).

---

## Documented intentional behaviors (not bugs)

Some tests document behavior that *looks* surprising but is intentional. If you ever want to change these, update the corresponding test:

| Behavior | Why | Test |
|---|---|---|
| Subtasks aren't replicated when a recurring task spawns | v1 keeps spawn logic minimal; users add subtasks per occurrence | `test_spawned_task_does_not_inherit_subtasks` |
| Re-completing an already-completed task is a no-op (no `completed_at` bump, no spawn) | Idempotent — saves data and avoids duplicate spawn | `test_double_complete_is_idempotent` |
| Completing all subtasks does NOT auto-complete the parent task | Subtasks are notes, not gates | `test_subtask_completion_does_not_complete_parent` |
| Invalid `category_id` silently orphans (no FK enforcement) | Pragmatic for SQLite; could be tightened later | `test_invalid_category_id_silently_orphans` |
| When user PATCHes `recurrence` + `status: completed` in one call, spawn uses the **pre-update** rule | Keeps existing schedules stable; to skip a spawn, change recurrence in a separate PATCH first | `test_spawn_uses_pre_update_recurrence_when_changed_inline` |
| Recurring overdue task spawns from its (overdue) due_date, not today | Schedule consistency over catch-up convenience | `test_recurring_overdue_task_completion_still_spawns` |
