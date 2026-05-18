"""Authentication: bcrypt password hashing + JWT bearer tokens."""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

import models
from database import get_db

# ----- Config from env -----
# In dev, falls back to a stable secret so existing sessions survive restarts.
# In prod (Render/Railway/etc.), MUST be set to a random value, e.g. via:
#     python -c "import secrets; print(secrets.token_urlsafe(64))"
SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-secret-do-not-use-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_DAYS = int(os.getenv("ACCESS_TOKEN_TTL_DAYS", "30"))

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


# ---------- Password helpers ----------

def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_ctx.verify(plain, hashed)
    except Exception:
        return False


# ---------- Token helpers ----------

def create_access_token(user_id: int) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=ACCESS_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


# ---------- FastAPI dependency ----------

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    """Resolve the bearer token → User row. 401s if anything is off."""
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = decode_token(creds.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ---------- Default categories on registration ----------

DEFAULT_CATEGORIES = [
    ("Personal", "#8b5cf6"),
    ("Work", "#06b6d4"),
    ("Health", "#10b981"),
    ("Learning", "#f59e0b"),
]


def seed_default_categories(db: Session, user: models.User) -> None:
    """Give a freshly-registered user the four starter categories."""
    for name, color in DEFAULT_CATEGORIES:
        db.add(models.Category(name=name, color=color, user_id=user.id))
    db.commit()
