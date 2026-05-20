"""Database engine + session setup.

Reads DATABASE_URL from the environment:
- `sqlite:///./todos.db` for local dev (the default if unset)
- `postgresql://...` for production (e.g. Render Postgres)

Render historically issues URLs starting with `postgres://`, which SQLAlchemy 2.x
no longer accepts — we normalize that to `postgresql://`.
"""
from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./todos.db")

# Heroku-style `postgres://` → SQLAlchemy 2.x `postgresql://`
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

_is_sqlite = DATABASE_URL.startswith("sqlite")

# SQLite needs check_same_thread=False to work with FastAPI's threading;
# Postgres doesn't take that arg. pool_pre_ping makes Postgres survive
# Render's idle-connection drops by validating connections on checkout.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=not _is_sqlite,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
