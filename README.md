# Orbit — Your Daily Command Center

A modern, advanced TODO app with a FastAPI backend and a React frontend. Designed to help you organize your day, not just track checkboxes.

## Features

- **Smart views** — Today, Upcoming, Overdue, Starred, Completed, plus per-category filters
- **Rich tasks** — title, description, priority (low/medium/high/urgent), due date & time, category, star
- **Subtasks** — break down work, track progress inline with a `done/total` chip
- **Categories** — colorful labels you can create, recolor, rename, delete
- **Dashboard** — at-a-glance stats, completion-rate, last-7-days bar chart, priority and category breakdowns
- **Search & filter** — instant search across title/description, priority filter
- **Dark mode** — auto-detects system preference, remembers your choice
- **Modern UI** — glassmorphism, gradients, Inter font, Lucide icons, smooth animations
- **Local-first** — single-user SQLite, runs entirely on your machine

## Tech stack

- **Backend**: FastAPI · SQLAlchemy · SQLite · Pydantic v2
- **Frontend**: React 18 · Vite · TailwindCSS · Lucide icons · date-fns

## Project layout

```
todo-app/
├── backend/
│   ├── main.py          # FastAPI app + routes
│   ├── crud.py          # DB operations & stats
│   ├── models.py        # SQLAlchemy models
│   ├── schemas.py       # Pydantic schemas
│   ├── database.py      # Engine & session
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   └── components/
    │       ├── Sidebar.jsx
    │       ├── Header.jsx
    │       ├── TaskItem.jsx
    │       ├── TaskForm.jsx
    │       └── Dashboard.jsx
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

## Setup & run

### 1) Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API at <http://localhost:8000>, interactive docs at <http://localhost:8000/docs>.

On first start the DB is created (`todos.db`) and seeded with four default categories: Personal, Work, Health, Learning.

### 2) Frontend (React + Vite)

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

App at <http://localhost:5173>. Vite proxies `/api/*` to the FastAPI server on port 8000.

## API reference (quick)

| Method | Path | Purpose |
|---|---|---|
| GET | `/tasks` | List tasks (filters: `view`, `category_id`, `priority`, `search`, `status`) |
| POST | `/tasks` | Create task (with optional `subtasks[]`) |
| PATCH | `/tasks/{id}` | Update any field |
| DELETE | `/tasks/{id}` | Delete |
| POST | `/tasks/{id}/subtasks` | Add subtask |
| PATCH | `/subtasks/{id}` | Toggle / rename subtask |
| DELETE | `/subtasks/{id}` | Delete subtask |
| GET / POST / PATCH / DELETE | `/categories` | Manage categories |
| GET | `/stats` | Aggregate stats for the dashboard |

`view` accepts: `today`, `upcoming`, `overdue`, `starred`, `completed`.

## Tips

- Press the `+ New Task` button or click any view to add quickly.
- Toggle the moon/sun icon to switch themes.
- Star tasks you want to focus on — they show up in the **Starred** view.
- Expand a task to manage its subtasks inline.

## Roadmap ideas

- Recurring tasks
- Drag-and-drop reordering
- Keyboard shortcuts (n / e / d / / for search)
- Notifications for overdue tasks
- Multi-user auth + cloud sync
