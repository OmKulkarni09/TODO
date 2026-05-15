# venOM — Hunt your day

A modern TODO app with a Marvel-Venom-themed UI. FastAPI backend + React frontend, designed to help you organize your day — not just check boxes.

Repo: <https://github.com/OmKulkarni09/TODO>

---

## 🚀 Quick start (for teammates pulling this repo)

You need three things installed:
- **Git** ([download](https://git-scm.com/downloads))
- **Python 3.10+** ([download](https://www.python.org/downloads/))
- **Node.js 18+** ([download](https://nodejs.org/))

Then, open a terminal and run:

### 1 · Clone the repo

```bash
git clone https://github.com/OmKulkarni09/TODO.git
cd TODO
```

### 2 · Start the backend (Terminal 1)

<details open>
<summary><b>Windows · PowerShell</b></summary>

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> If PowerShell blocks the activation script with `running scripts is disabled`, either run:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (one-time)
> or skip activation and call the venv's python directly: `.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000`

</details>

<details>
<summary><b>macOS / Linux · bash or zsh</b></summary>

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

</details>

When you see `Uvicorn running on http://127.0.0.1:8000`, the API is up. Visit <http://localhost:8000/docs> for the interactive Swagger UI.

On first start, a SQLite file `todos.db` is created and seeded with four default categories: **Personal**, **Work**, **Health**, **Learning**.

### 3 · Start the frontend (Terminal 2)

Open a **second terminal** (leave the backend running in the first):

```bash
cd frontend
npm install
npm run dev
```

When you see `Local: http://localhost:5173/`, open that URL in your browser. **You should see the app.** 🎉

### 4 · Run the tests (optional sanity check)

To confirm everything works end-to-end:

```bash
# Backend (Terminal 1, with venv activated)
cd backend
pytest

# Frontend (Terminal 2)
cd frontend
npm test
```

Both should report all green (133 backend + 66 frontend = 202 tests). Full docs in [TESTING.md](TESTING.md).

---

## Features

- **Smart views** — Today, Upcoming, Overdue, Starred, Completed, Calendar, plus per-category filters
- **Calendar** — month-grid heat-map showing real and projected task density, with a day-detail panel and stats tiles
- **Rich tasks** — title, description, priority (low/medium/high/urgent), due date & time, category, star, subtasks
- **Recurring tasks** — daily / weekdays / weekly / monthly / yearly. Spawn the next occurrence automatically on completion. Series-aware delete, undo, and grouped completion counts
- **Dashboard** — stat tiles, smooth line graph of completions per day, priority and category breakdowns, **Recently Completed** with filters
- **Celebration animation** — confetti rain + glowing "Congrats!" when you complete a task
- **venOM theme** — pitch-black obsidian surfaces, toxic-green accents, Marvel Venom logo as the brand mark, glowing UI elements
- **Themed confirm dialog** — replaces the browser pop-up. Series-delete gets a three-button choice (Cancel · Just this one · Entire series)
- **Local-first** — single-user SQLite, runs entirely on your machine, no cloud accounts needed

## Tech stack

- **Backend**: FastAPI · SQLAlchemy · SQLite · Pydantic v2
- **Frontend**: React 18 · Vite · TailwindCSS · Lucide icons · date-fns
- **Tests**: pytest (backend) · Vitest + Testing Library (frontend)

## Project layout

```
TODO/
├── backend/
│   ├── main.py            # FastAPI app + routes + lifespan migrations
│   ├── crud.py            # DB ops, recurrence math, series cascade
│   ├── models.py          # SQLAlchemy models
│   ├── schemas.py         # Pydantic schemas
│   ├── database.py        # Engine & session
│   ├── requirements.txt
│   ├── requirements-test.txt
│   ├── pytest.ini
│   └── tests/             # 133 pytest tests
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── components/    # Sidebar, Header, TaskItem, TaskForm,
│   │   │                  # Dashboard, Calendar, ConfirmProvider,
│   │   │                  # Dropdown, Celebration, VenomSpider
│   │   └── utils/
│   │       └── series.js  # groupBySeries + getSeriesRootId
│   ├── public/brand/      # Venom logo PNGs
│   ├── package.json
│   ├── vite.config.js
│   ├── vitest.config.js
│   └── tailwind.config.js
├── .github/workflows/test.yml   # CI: runs both test suites on every push
├── TESTING.md             # Test suite documentation
├── DEPLOYMENT.md          # How to push to GitHub + deploy to Render/Vercel
└── README.md              # You are here
```

## API reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/tasks` | List tasks (filters: `view`, `category_id`, `priority`, `search`, `status`) |
| POST | `/tasks` | Create task (with optional `subtasks[]`) |
| PATCH | `/tasks/{id}` | Update any field; auto-spawns next occurrence on completion of a recurring task |
| DELETE | `/tasks/{id}` | Delete a single task (cascades to its spawned descendants) |
| DELETE | `/tasks/{id}/series` | Walk to root, then nuke the whole recurring series |
| POST | `/tasks/{id}/subtasks` | Add subtask |
| PATCH | `/subtasks/{id}` | Toggle / rename subtask |
| DELETE | `/subtasks/{id}` | Delete subtask |
| GET / POST / PATCH / DELETE | `/categories` | Manage categories (delete nulls out `category_id` on tasks, doesn't cascade) |
| GET | `/stats` | Aggregate stats for the dashboard |

`view` accepts: `today`, `upcoming`, `overdue`, `starred`, `completed`. Full docs are at <http://localhost:8000/docs> when the backend is running.

## Tips

- Click **+ New hunt** or use any view to add quickly
- Toggle the moon/sun in the header to switch theme
- Star tasks you must close today — they appear in **Starred**
- Expand a task to manage its subtasks inline
- For recurring tasks: the violet `↻ Daily` chip means it'll spawn next on completion. To stop the recurrence, edit the task and set **Repeat → Never**
- On the Calendar view, click any day to see its tasks. Future occurrences of recurring tasks appear as dashed-outline projections — they're previews and won't appear in stats until they actually exist

## Common troubleshooting

| Symptom | Fix |
|---|---|
| `python: command not found` on macOS | Use `python3` and `python3 -m venv .venv` |
| `node: command not found` after install | Restart your terminal so PATH picks up the new install, then try again |
| PowerShell blocks venv activation | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (or skip activation and use `.venv\Scripts\python.exe` directly) |
| Backend starts but frontend shows blank/network errors | Make sure the backend is still running on port 8000 — Vite proxies `/api/*` to it |
| Port 8000 or 5173 already in use | Kill the other process, or change ports: backend `uvicorn ... --port 8001` and update `frontend/vite.config.js` proxy target |
| `npm install` fails on Windows due to long paths | Run `git config --system core.longpaths true` once, then retry |

## Deploying

Want to put it live on the web (Vercel + Render)? See [DEPLOYMENT.md](DEPLOYMENT.md).

## License

Personal project. No formal license — feel free to fork for learning, but the Venom imagery is Marvel/Sony IP and shouldn't be redistributed commercially.
