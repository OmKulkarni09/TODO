from calendar import monthrange
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

import models
import schemas


def _next_due_date(rule: Optional[str], current: Optional[datetime]) -> Optional[datetime]:
    """Advance the due date by one recurrence step. Anchors off `current` to
    keep the schedule stable even if completed late (e.g. Mon 9am standup
    completed at 2pm → Tuesday's still due at Tue 9am)."""
    if not rule or not current:
        return None
    if rule == "daily":
        return current + timedelta(days=1)
    if rule == "weekdays":
        nxt = current + timedelta(days=1)
        while nxt.weekday() >= 5:  # 5=Sat, 6=Sun
            nxt += timedelta(days=1)
        return nxt
    if rule == "weekly":
        return current + timedelta(weeks=1)
    if rule == "monthly":
        month = current.month + 1
        year = current.year
        if month > 12:
            month = 1
            year += 1
        last_day = monthrange(year, month)[1]
        return current.replace(year=year, month=month, day=min(current.day, last_day))
    if rule == "yearly":
        try:
            return current.replace(year=current.year + 1)
        except ValueError:
            # Feb 29 in non-leap year → fall back to Feb 28
            return current.replace(year=current.year + 1, day=28)
    return None


# ---------- Categories ----------

def list_categories(db: Session):
    return db.query(models.Category).order_by(models.Category.name).all()


def create_category(db: Session, data: schemas.CategoryCreate):
    cat = models.Category(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def update_category(db: Session, category_id: int, data: schemas.CategoryUpdate):
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat


def delete_category(db: Session, category_id: int):
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        return False
    db.query(models.Task).filter(models.Task.category_id == category_id).update(
        {"category_id": None}
    )
    db.delete(cat)
    db.commit()
    return True


# ---------- Tasks ----------

def _task_query(db: Session):
    return db.query(models.Task).options(
        joinedload(models.Task.category),
        joinedload(models.Task.subtasks),
    )


def list_tasks(
    db: Session,
    status: Optional[str] = None,
    category_id: Optional[int] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    view: Optional[str] = None,
):
    q = _task_query(db)

    if status:
        q = q.filter(models.Task.status == status)
    if category_id is not None:
        q = q.filter(models.Task.category_id == category_id)
    if priority:
        q = q.filter(models.Task.priority == priority)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (models.Task.title.ilike(like)) | (models.Task.description.ilike(like))
        )

    now = datetime.utcnow()
    if view == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        q = q.filter(
            and_(
                models.Task.due_date >= start,
                models.Task.due_date < end,
                models.Task.status != "completed",
            )
        )
    elif view == "upcoming":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
            days=1
        )
        q = q.filter(
            and_(models.Task.due_date >= start, models.Task.status != "completed")
        )
    elif view == "overdue":
        q = q.filter(
            and_(models.Task.due_date < now, models.Task.status != "completed")
        )
    elif view == "starred":
        q = q.filter(models.Task.is_starred == True)  # noqa: E712
    elif view == "completed":
        q = q.filter(models.Task.status == "completed")

    return q.order_by(
        models.Task.status != "completed",
        models.Task.position,
        models.Task.created_at.desc(),
    ).all()


def get_task(db: Session, task_id: int):
    return _task_query(db).filter(models.Task.id == task_id).first()


def create_task(db: Session, data: schemas.TaskCreate):
    payload = data.model_dump(exclude={"subtasks"})
    # If the caller creates a task already-completed (e.g. importing/seeding
    # historical data), make sure completed_at is populated so downstream
    # views (Recently Completed, calendar heat-map) don't filter it out.
    if payload.get("status") == "completed":
        payload.setdefault("completed_at", datetime.utcnow())
    max_pos = db.query(func.max(models.Task.position)).scalar() or 0
    payload["position"] = max_pos + 1
    task = models.Task(**payload)
    db.add(task)
    db.flush()

    if data.subtasks:
        for s in data.subtasks:
            db.add(models.Subtask(task_id=task.id, **s.model_dump()))

    db.commit()
    return get_task(db, task.id)


def _delete_descendants(db: Session, parent_id: int) -> int:
    """Recursively delete all tasks spawned from this one. Returns count deleted."""
    children = (
        db.query(models.Task)
        .filter(models.Task.parent_task_id == parent_id)
        .all()
    )
    count = 0
    for c in children:
        count += _delete_descendants(db, c.id)
        db.delete(c)
        count += 1
    return count


def update_task(db: Session, task_id: int, data: schemas.TaskUpdate):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        return None

    updates = data.model_dump(exclude_unset=True)

    transitioning_to_complete = (
        "status" in updates
        and updates["status"] == "completed"
        and task.status != "completed"
    )
    transitioning_from_complete = (
        "status" in updates
        and updates["status"] != "completed"
        and task.status == "completed"
    )

    if transitioning_to_complete:
        updates["completed_at"] = datetime.utcnow()
    elif transitioning_from_complete:
        updates["completed_at"] = None

    # Capture recurrence state BEFORE applying updates
    spawn_rule = task.recurrence
    spawn_anchor = task.due_date
    has_descendants = (
        db.query(models.Task.id)
        .filter(models.Task.parent_task_id == task_id)
        .first()
        is not None
    )

    for k, v in updates.items():
        setattr(task, k, v)

    # On UN-completion: drop any spawned successors. They shouldn't exist
    # if the parent isn't actually completed — otherwise the user sees
    # duplicate-looking pending entries.
    if transitioning_from_complete:
        _delete_descendants(db, task_id)

    # On COMPLETION: spawn the next occurrence ONLY if no successor exists
    # yet. Prevents duplicate spawns from complete → un-complete → complete
    # cycles.
    if (
        transitioning_to_complete
        and spawn_rule
        and spawn_anchor
        and not has_descendants
    ):
        next_due = _next_due_date(spawn_rule, spawn_anchor)
        if next_due:
            max_pos = db.query(func.max(models.Task.position)).scalar() or 0
            db.add(
                models.Task(
                    title=task.title,
                    description=task.description,
                    priority=task.priority,
                    status="pending",
                    due_date=next_due,
                    category_id=task.category_id,
                    is_starred=task.is_starred,
                    recurrence=spawn_rule,
                    parent_task_id=task_id,
                    position=max_pos + 1,
                )
            )

    db.commit()
    return get_task(db, task_id)


def delete_task(db: Session, task_id: int):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        return False
    # Cascade: when a recurring parent is deleted, drop its lineage too
    _delete_descendants(db, task_id)
    db.delete(task)
    db.commit()
    return True


def _find_series_root(db: Session, task_id: int):
    """Walk parent_task_id chain back to the recurring series root."""
    current = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not current:
        return None
    safety = 500
    while current.parent_task_id is not None and safety > 0:
        parent = (
            db.query(models.Task)
            .filter(models.Task.id == current.parent_task_id)
            .first()
        )
        if not parent:
            break
        current = parent
        safety -= 1
    return current


def delete_task_series(db: Session, task_id: int):
    """Nuke an entire recurring series — find the root, then cascade-delete
    everything spawned from it. Idempotent: deleting any member of a series
    deletes the whole thing."""
    root = _find_series_root(db, task_id)
    if not root:
        return False
    _delete_descendants(db, root.id)
    db.delete(root)
    db.commit()
    return True


# ---------- Subtasks ----------

def add_subtask(db: Session, task_id: int, data: schemas.SubtaskCreate):
    sub = models.Subtask(task_id=task_id, **data.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def update_subtask(db: Session, subtask_id: int, data: schemas.SubtaskUpdate):
    sub = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if not sub:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(sub, k, v)
    db.commit()
    db.refresh(sub)
    return sub


def delete_subtask(db: Session, subtask_id: int):
    sub = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if not sub:
        return False
    db.delete(sub)
    db.commit()
    return True


# ---------- Stats ----------

def stats(db: Session):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    total = db.query(func.count(models.Task.id)).scalar() or 0
    completed = (
        db.query(func.count(models.Task.id))
        .filter(models.Task.status == "completed")
        .scalar()
        or 0
    )
    pending = (
        db.query(func.count(models.Task.id))
        .filter(models.Task.status == "pending")
        .scalar()
        or 0
    )
    in_progress = (
        db.query(func.count(models.Task.id))
        .filter(models.Task.status == "in_progress")
        .scalar()
        or 0
    )
    overdue = (
        db.query(func.count(models.Task.id))
        .filter(
            and_(models.Task.due_date < now, models.Task.status != "completed")
        )
        .scalar()
        or 0
    )
    due_today = (
        db.query(func.count(models.Task.id))
        .filter(
            and_(
                models.Task.due_date >= today_start,
                models.Task.due_date < today_end,
                models.Task.status != "completed",
            )
        )
        .scalar()
        or 0
    )

    completion_rate = round((completed / total) * 100, 1) if total else 0.0

    priority_rows = (
        db.query(models.Task.priority, func.count(models.Task.id))
        .group_by(models.Task.priority)
        .all()
    )
    by_priority = {p: c for p, c in priority_rows}
    for p in ("low", "medium", "high", "urgent"):
        by_priority.setdefault(p, 0)

    cat_rows = (
        db.query(
            models.Category.id,
            models.Category.name,
            models.Category.color,
            func.count(models.Task.id),
        )
        .outerjoin(models.Task, models.Task.category_id == models.Category.id)
        .group_by(models.Category.id)
        .all()
    )
    by_category = [
        {"id": cid, "name": name, "color": color, "count": count}
        for cid, name, color, count in cat_rows
    ]

    seven = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        cnt = (
            db.query(func.count(models.Task.id))
            .filter(
                and_(
                    models.Task.completed_at >= day_start,
                    models.Task.completed_at < day_end,
                )
            )
            .scalar()
            or 0
        )
        seven.append({"date": day_start.strftime("%a"), "count": cnt})

    return schemas.Stats(
        total=total,
        completed=completed,
        pending=pending,
        in_progress=in_progress,
        overdue=overdue,
        due_today=due_today,
        completion_rate=completion_rate,
        by_priority=by_priority,
        by_category=by_category,
        completed_last_7_days=seven,
    )
