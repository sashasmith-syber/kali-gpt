"""SQLAlchemy engine and session factory (DATABASE_URL driven)."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Generator

from alembic.autogenerate import compare_metadata
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, event
from sqlalchemy import inspect
from sqlalchemy.orm import Session, sessionmaker

logger = logging.getLogger(__name__)

DEFAULT_SQLITE_URL = "sqlite:///./data/kaligpt.db"


def _database_url() -> str:
    return os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL).strip() or DEFAULT_SQLITE_URL


def _ensure_sqlite_parent(url: str) -> None:
    if not url.startswith("sqlite"):
        return
    # sqlite:////data/kaligpt.db or sqlite:///./data/kaligpt.db
    raw = url.split(":///", 1)[-1]
    if raw.startswith("/") and not raw.startswith("//"):
        path = Path(raw)
    else:
        path = Path(raw)
    if path.parent and str(path.parent) not in (".", ""):
        path.parent.mkdir(parents=True, exist_ok=True)


DATABASE_URL = _database_url()
_ensure_sqlite_parent(DATABASE_URL)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    future=True,
)

if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _sqlite_pragma(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Apply schema migrations and baseline matching legacy schemas."""
    database_url = _database_url()
    _ensure_sqlite_parent(database_url)
    config_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    config = Config(str(config_path))
    config.set_main_option(
        "script_location", str(config_path.parent / "alembic")
    )
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

    tables = set(inspect(engine).get_table_names())
    if "users" in tables and "alembic_version" not in tables:
        from db import models  # noqa: F401
        from db.base import Base

        with engine.connect() as connection:
            differences = compare_metadata(
                MigrationContext.configure(connection), Base.metadata
            )
        if differences:
            raise RuntimeError(
                "Existing database schema does not match the application models; "
                "refusing to baseline it."
            )
        command.stamp(config, "head")

    command.upgrade(config, "head")
    logger.info("Database initialized (%s)", _database_url().split("://")[0])
