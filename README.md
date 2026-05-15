# venOM — Hunt your day

A modern TODO app with a Marvel-Venom-themed UI. FastAPI backend + React frontend, designed to help you organize your day — not just check boxes.

Repo: <https://github.com/OmKulkarni09/TODO>

---

## 🚀 Quick start — **one command**

Prerequisites (one-time installs):
- **Git** ([download](https://git-scm.com/downloads))
- **Python 3.10+** ([download](https://www.python.org/downloads/))
- **Node.js 18+** ([download](https://nodejs.org/))

### Clone, then run:

```bash
git clone https://github.com/OmKulkarni09/TODO.git
cd TODO
```

<details open>
<summary><b>🪟 Windows · PowerShell</b></summary>

```powershell
.\start.ps1
```

> If PowerShell blocks the script with *"running scripts is disabled"*, run this **once** then retry:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

</details>

<details open>
<summary><b>🐧 macOS / Linux · bash or zsh</b></summary>

```bash
chmod +x start.sh    # one-time, makes the script executable
./start.sh
```

</details>

That's it. The script will:

1. Verify Python and Node are installed (clear error if not)
2. Create the Python venv (first run only, ~10s)
3. Install backend deps via `pip` (first run only, ~30s)
4. Install frontend deps via `npm` (first run only, ~1 min)
5. Boot the backend on `:8000` and the frontend on `:5173`
6. **Auto-open your browser to <http://localhost:5173>**

Subsequent runs skip the install steps — you go from `./start.sh` to a working app in ~3 seconds.

**Stop:** press `Ctrl+C` once. The script kills both processes cleanly.

> First start creates `backend/todos.db` (a SQLite file) and seeds four default categories. All your data lives in that file and persists across restarts.

### Optional: run the tests

```bash
# Backend (133 tests, ~6s)
cd backend
.venv/bin/pytest          # macOS/Linux
# .venv\Scripts\pytest    # Windows

# Frontend (66 tests, ~9s)
cd frontend
npm test
```

Full docs in [TESTING.md](TESTING.md).

---

## Manual setup (alternative)

If you'd rather not use the startup script, here's the same thing done by hand:

<details>
<summary>Manual two-terminal flow</summary>

**Terminal 1 — backend:**
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1     # Windows
# source .venv/bin/activate      # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

</details>

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
├── start.sh               # ← one-command launcher for macOS/Linux
├── start.ps1              # ← one-command launcher for Windows
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
| `./start.sh: Permission denied` (Linux/macOS) | Run `chmod +x start.sh` once, then retry |
| PowerShell: *"running scripts is disabled on this system"* | Run **once**: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then retry `.\start.ps1` |
| `python: command not found` on macOS | Install via [python.org](https://www.python.org/downloads/) or `brew install python`. The script tries both `python3` and `python`. |
| `node: command not found` after fresh install | Restart your terminal so PATH picks up Node, then re-run the start script |
| Backend starts but frontend shows blank/network errors | Backend is probably crashing — check the script output. Vite proxies `/api/*` to `:8000`, so backend must be up. |
| Port 8000 or 5173 already in use | Kill the other process (`lsof -ti:8000 \| xargs kill` on macOS/Linux, or use Resource Monitor on Windows). Then re-run. |
| `npm install` fails on Windows with long-path errors | Run **once**: `git config --system core.longpaths true`, then retry |
| Want to wipe install and start over | Delete `backend/.venv` and `frontend/node_modules`, then re-run the start script |
| Want to wipe all your tasks | Delete `backend/todos.db` — it'll be re-created empty on next start |

## Deploying

Want to put it live on the web (Vercel + Render)? See [DEPLOYMENT.md](DEPLOYMENT.md).

## License

Personal project. No formal license — feel free to fork for learning, but the Venom imagery is Marvel/Sony IP and shouldn't be redistributed commercially.
