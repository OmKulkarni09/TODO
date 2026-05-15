from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class SubtaskBase(BaseModel):
    title: str
    completed: bool = False


class SubtaskCreate(SubtaskBase):
    pass


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    completed: Optional[bool] = None


class Subtask(SubtaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: int


class CategoryBase(BaseModel):
    name: str
    color: str = "#6366f1"


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class Category(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: str = "medium"
    status: str = "pending"
    due_date: Optional[datetime] = None
    category_id: Optional[int] = None
    is_starred: bool = False
    recurrence: Optional[str] = None


class TaskCreate(TaskBase):
    subtasks: Optional[List[SubtaskCreate]] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    category_id: Optional[int] = None
    is_starred: Optional[bool] = None
    position: Optional[int] = None
    recurrence: Optional[str] = None


class Task(TaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    position: int
    parent_task_id: Optional[int] = None
    category: Optional[Category] = None
    subtasks: List[Subtask] = []


class Stats(BaseModel):
    total: int
    completed: int
    pending: int
    in_progress: int
    overdue: int
    due_today: int
    completion_rate: float
    by_priority: dict
    by_category: List[dict]
    completed_last_7_days: List[dict]
