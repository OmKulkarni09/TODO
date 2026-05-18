"""Shared pytest fixtures.

Each test gets a brand-new in-memory SQLite database via dependency override
on `get_db`. This keeps tests fast (no disk I/O) and isolated (no state leaks
between tests) and — importantly — never touches the user's real `todos.db`.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Make the backend package importable when running `pytest` from anywhere
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, get_db  # noqa: E402
from main import app  # noqa: E402
import auth  # noqa: E402
import models  # noqa: E402,F401  (ensures table metadata is loaded)


@pytest.fixture()
def engine():
    """Fresh in-memory SQLite per test, shared across connections via StaticPool."""
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    """A SQLAlchemy session bound to the test engine."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(engine):
    """A FastAPI TestClient whose `get_db` is wired to the test engine AND
    whose `get_current_user` returns a fixed test user. This lets all the
    pre-existing tests (which were written before auth) act as a single
    authenticated user without any code changes.

    For tests that need to exercise auth itself (login, register, multi-user
    isolation), use the `unauth_client` fixture instead — it doesn't override
    `get_current_user`, so requests are subject to real bearer-token checks.
    """
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_current_user():
        db = SessionLocal()
        try:
            user = db.query(models.User).filter_by(email="test@local").first()
            if not user:
                user = models.User(
                    email="test@local",
                    password_hash=auth.hash_password("password"),
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            return user
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[auth.get_current_user] = override_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def unauth_client(engine):
    """A TestClient without the get_current_user override — auth tests use
    this to exercise the real bearer-token flow."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def seeded_client(client, engine):
    """A client whose DB already has the four default categories seeded.

    This mirrors what the production lifespan does on first boot.
    """
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
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
    return client


# ---- helpers --------------------------------------------------------------

def make_task(client, **overrides) -> dict:
    """POST /tasks helper that returns the created task payload."""
    payload = {
        "title": "Test task",
        "priority": "medium",
    }
    payload.update(overrides)
    response = client.post("/tasks", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def make_category(client, name="Cat", color="#b8ff3a") -> dict:
    response = client.post("/categories", json={"name": name, "color": color})
    assert response.status_code == 200, response.text
    return response.json()


def iso(dt: datetime) -> str:
    """ISO string the API accepts."""
    return dt.isoformat()


@pytest.fixture()
def now():
    return datetime(2026, 5, 15, 10, 0, 0)


@pytest.fixture()
def factory(client):
    """A convenience namespace bundling helpers + the client."""

    class Factory:
        def __init__(self, c):
            self.client = c

        def task(self, **kwargs):
            return make_task(self.client, **kwargs)

        def category(self, **kwargs):
            return make_category(self.client, **kwargs)

    return Factory(client)
