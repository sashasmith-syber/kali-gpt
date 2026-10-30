"""Database package for KaliGPT (SQLite local-first, Postgres-ready)."""

from db.session import SessionLocal, engine, get_db, init_db
from db.base import Base

__all__ = ["Base", "SessionLocal", "engine", "get_db", "init_db"]
