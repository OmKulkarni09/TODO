import os
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import Base, engine, get_db


def _ensure_schema():
    """Lightweight idempotent migration: add columns introduced after the
    initial schema (SQLite ALTER TABLE). Run after create_all so new installs
    get them via the model, and existing DBs get them appended in place."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        if inspector.has_table("tasks"):
            cols = {c["name"] for c in inspector.get_columns("tasks")}
            if "recurrence" not in cols:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN recurrence VARCHAR"))
            if "parent_task_id" not in cols:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER"))
            if "user_id" not in cols:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN user_id INTEGER"))
            # Backfill completed_at on legacy completed tasks
            conn.execute(
                text(
                    "UPDATE tasks SET completed_at = created_at "
                    "WHERE status='completed' AND completed_at IS NULL"
                )
            )
        if inspector.has_table("categories"):
            ccols = {c["name"] for c in inspector.get_columns("categories")}
            if "user_id" not in ccols:
                conn.execute(text("ALTER TABLE categories ADD COLUMN user_id INTEGER"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_schema()
    yield


app = FastAPI(title="venOM Todo API", lifespan=lifespan)

# CORS — in dev, allow everything. In prod (Render), set CORS_ORIGINS to a
# comma-separated list of frontend URLs, e.g.
#   CORS_ORIGINS=https://venom-todo.vercel.app,http://localhost:5173
_cors_env = os.getenv("CORS_ORIGINS", "*").strip()
_origins = ["*"] if _cors_env == "*" else [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"name": "venOM Todo API", "status": "ok"}


# =====================================================================
# Authentication
# =====================================================================

@app.post("/auth/register", response_model=schemas.TokenResponse)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        )
    user = models.User(
        email=data.email,
        password_hash=auth.hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    auth.seed_default_categories(db, user)
    token = auth.create_access_token(user.id)
    return schemas.TokenResponse(access_token=token, user=user)


@app.post("/auth/login", response_model=schemas.TokenResponse)
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not auth.verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = auth.create_access_token(user.id)
    return schemas.TokenResponse(access_token=token, user=user)


@app.get("/auth/me", response_model=schemas.User)
def me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


# =====================================================================
# Categories (per-user)
# =====================================================================

@app.get("/categories", response_model=List[schemas.Category])
def list_categories(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return crud.list_categories(db, current_user.id)


@app.post("/categories", response_model=schemas.Category)
def create_category(
    data: schemas.CategoryCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return crud.create_category(db, current_user.id, data)


@app.patch("/categories/{category_id}", response_model=schemas.Category)
def update_category(
    category_id: int,
    data: schemas.CategoryUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    cat = crud.update_category(db, current_user.id, category_id, data)
    if not cat:
        raise HTTPException(404, "Category not found")
    return cat


@app.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not crud.delete_category(db, current_user.id, category_id):
        raise HTTPException(404, "Category not found")
    return {"ok": True}


# =====================================================================
# Tasks (per-user)
# =====================================================================

@app.get("/tasks", response_model=List[schemas.Task])
def list_tasks(
    status: Optional[str] = None,
    category_id: Optional[int] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    view: Optional[str] = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return crud.list_tasks(
        db, current_user.id, status, category_id, priority, search, view
    )


@app.get("/tasks/{task_id}", response_model=schemas.Task)
def get_task(
    task_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    task = crud.get_task(db, current_user.id, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@app.post("/tasks", response_model=schemas.Task)
def create_task(
    data: schemas.TaskCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return crud.create_task(db, current_user.id, data)


@app.patch("/tasks/{task_id}", response_model=schemas.Task)
def update_task(
    task_id: int,
    data: schemas.TaskUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    task = crud.update_task(db, current_user.id, task_id, data)
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not crud.delete_task(db, current_user.id, task_id):
        raise HTTPException(404, "Task not found")
    return {"ok": True}


@app.delete("/tasks/{task_id}/series")
def delete_task_series(
    task_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not crud.delete_task_series(db, current_user.id, task_id):
        raise HTTPException(404, "Task not found")
    return {"ok": True}


# =====================================================================
# Subtasks (scoped via parent task ownership)
# =====================================================================

@app.post("/tasks/{task_id}/subtasks", response_model=schemas.Subtask)
def add_subtask(
    task_id: int,
    data: schemas.SubtaskCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    sub = crud.add_subtask(db, current_user.id, task_id, data)
    if sub is None:
        raise HTTPException(404, "Task not found")
    return sub


@app.patch("/subtasks/{subtask_id}", response_model=schemas.Subtask)
def update_subtask(
    subtask_id: int,
    data: schemas.SubtaskUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    sub = crud.update_subtask(db, current_user.id, subtask_id, data)
    if not sub:
        raise HTTPException(404, "Subtask not found")
    return sub


@app.delete("/subtasks/{subtask_id}")
def delete_subtask(
    subtask_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not crud.delete_subtask(db, current_user.id, subtask_id):
        raise HTTPException(404, "Subtask not found")
    return {"ok": True}


# =====================================================================
# Stats (per-user)
# =====================================================================

@app.get("/stats", response_model=schemas.Stats)
def stats(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return crud.stats(db, current_user.id)
