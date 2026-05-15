from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

import crud
import models
import schemas
from database import Base, engine, get_db


def _ensure_schema():
    """Lightweight idempotent migration: add columns introduced after the
    initial schema (SQLite ALTER TABLE). Run after create_all so new installs
    get them via the model, and existing DBs get them appended in place."""
    inspector = inspect(engine)
    if not inspector.has_table("tasks"):
        return
    cols = {c["name"] for c in inspector.get_columns("tasks")}
    with engine.begin() as conn:
        if "recurrence" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN recurrence VARCHAR"))
        if "parent_task_id" not in cols:
            conn.execute(
                text("ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER")
            )
        # Idempotent backfill: any completed task with no completed_at gets
        # its created_at copied over. Fixes legacy seed-data that was inserted
        # with status=completed but didn't go through the normal transition.
        conn.execute(
            text(
                "UPDATE tasks SET completed_at = created_at "
                "WHERE status='completed' AND completed_at IS NULL"
            )
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_schema()
    db = next(get_db())
    if db.query(models.Category).count() == 0:
        defaults = [
            ("Personal", "#8b5cf6"),
            ("Work", "#06b6d4"),
            ("Health", "#10b981"),
            ("Learning", "#f59e0b"),
        ]
        for name, color in defaults:
            db.add(models.Category(name=name, color=color))
        db.commit()
    db.close()
    yield


app = FastAPI(title="Modern Todo API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"name": "Modern Todo API", "status": "ok"}


# ---------- Categories ----------

@app.get("/categories", response_model=List[schemas.Category])
def list_categories(db: Session = Depends(get_db)):
    return crud.list_categories(db)


@app.post("/categories", response_model=schemas.Category)
def create_category(data: schemas.CategoryCreate, db: Session = Depends(get_db)):
    return crud.create_category(db, data)


@app.patch("/categories/{category_id}", response_model=schemas.Category)
def update_category(
    category_id: int, data: schemas.CategoryUpdate, db: Session = Depends(get_db)
):
    cat = crud.update_category(db, category_id, data)
    if not cat:
        raise HTTPException(404, "Category not found")
    return cat


@app.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    if not crud.delete_category(db, category_id):
        raise HTTPException(404, "Category not found")
    return {"ok": True}


# ---------- Tasks ----------

@app.get("/tasks", response_model=List[schemas.Task])
def list_tasks(
    status: Optional[str] = None,
    category_id: Optional[int] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    view: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return crud.list_tasks(db, status, category_id, priority, search, view)


@app.get("/tasks/{task_id}", response_model=schemas.Task)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@app.post("/tasks", response_model=schemas.Task)
def create_task(data: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db, data)


@app.patch("/tasks/{task_id}", response_model=schemas.Task)
def update_task(
    task_id: int, data: schemas.TaskUpdate, db: Session = Depends(get_db)
):
    task = crud.update_task(db, task_id, data)
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    if not crud.delete_task(db, task_id):
        raise HTTPException(404, "Task not found")
    return {"ok": True}


@app.delete("/tasks/{task_id}/series")
def delete_task_series(task_id: int, db: Session = Depends(get_db)):
    if not crud.delete_task_series(db, task_id):
        raise HTTPException(404, "Task not found")
    return {"ok": True}


# ---------- Subtasks ----------

@app.post("/tasks/{task_id}/subtasks", response_model=schemas.Subtask)
def add_subtask(
    task_id: int, data: schemas.SubtaskCreate, db: Session = Depends(get_db)
):
    if not crud.get_task(db, task_id):
        raise HTTPException(404, "Task not found")
    return crud.add_subtask(db, task_id, data)


@app.patch("/subtasks/{subtask_id}", response_model=schemas.Subtask)
def update_subtask(
    subtask_id: int, data: schemas.SubtaskUpdate, db: Session = Depends(get_db)
):
    sub = crud.update_subtask(db, subtask_id, data)
    if not sub:
        raise HTTPException(404, "Subtask not found")
    return sub


@app.delete("/subtasks/{subtask_id}")
def delete_subtask(subtask_id: int, db: Session = Depends(get_db)):
    if not crud.delete_subtask(db, subtask_id):
        raise HTTPException(404, "Subtask not found")
    return {"ok": True}


# ---------- Stats ----------

@app.get("/stats", response_model=schemas.Stats)
def stats(db: Session = Depends(get_db)):
    return crud.stats(db)
