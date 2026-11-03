"""SQLAlchemy engine and session factory (DATABASE_URL driven)."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Generator

from sqlalchemy import DateTime, Text, create_engine, event, inspect
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

_LEGACY_SCHEMA = {
    "users": {
        "columns": {
            "id": ("INTEGER", False),
            "username": ("VARCHAR(50)", False),
            "email": ("VARCHAR(255)", False),
            "full_name": ("VARCHAR(255)", True),
            "hashed_password": ("VARCHAR(255)", True),
            "role": ("VARCHAR(32)", False),
            "disabled": ("BOOLEAN", False),
            "auth_provider": ("VARCHAR(32)", False),
            "external_subject": ("VARCHAR(255)", True),
            "created_at": ("DATETIME", False),
        },
        "unique": {"username", "email", "external_subject"},
        "primary_key": {"id"},
    },
    "api_keys": {
        "columns": {
            "id": ("INTEGER", False),
            "key": ("VARCHAR(128)", False),
            "name": ("VARCHAR(128)", False),
            "username": ("VARCHAR(50)", False),
            "created_at": ("DATETIME", False),
            "expires_at": ("DATETIME", True),
            "is_active": ("BOOLEAN", False),
        },
        "unique": {"key"},
        "primary_key": {"id"},
    },
    "app_settings": {
        "columns": {
            "key": ("VARCHAR(128)", False),
            "value": ("TEXT", False),
            "updated_at": ("DATETIME", False),
        },
        "unique": set(),
        "primary_key": {"key"},
    },
}


def _escape_configparser_percent(value: str) -> str:
    return value.replace("%", "%%")


def _column_type_name(value) -> str:
    if isinstance(value, DateTime):
        return "DATETIME"
    if isinstance(value, Text):
        return "TEXT"
    return str(value).upper()


def _has_legacy_schema(connection) -> bool:
    inspector = inspect(connection)
    if not set(_LEGACY_SCHEMA).issubset(inspector.get_table_names()):
        return False
    for table, expected in _LEGACY_SCHEMA.items():
        columns = {
            column["name"]: (
                _column_type_name(column["type"]),
                column["nullable"],
            )
            for column in inspector.get_columns(table)
        }
        if columns != expected["columns"]:
            return False
        primary_key = set(inspector.get_pk_constraint(table).get("constrained_columns") or [])
        if primary_key != expected["primary_key"]:
            return False
        unique_columns = {
            column
            for constraint in inspector.get_unique_constraints(table)
            for column in (constraint.get("column_names") or [])
        }
        unique_columns.update(
            column
            for index in inspector.get_indexes(table)
            if index.get("unique")
            for column in index.get("column_names") or []
        )
        if unique_columns != expected["unique"]:
            return False
    return True


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Apply migrations, baselining only a schema verified against the legacy model."""
    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parents[1]
    _ensure_sqlite_parent(_database_url())
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    database_url = _database_url()
    config.set_main_option(
        "sqlalchemy.url", _escape_configparser_percent(database_url)
    )
    migration_engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False} if database_url.startswith("sqlite") else {},
        future=True,
    )
    try:
        with migration_engine.connect() as connection:
            tables = set(inspect(connection).get_table_names())
            needs_baseline = (
                "alembic_version" not in tables
                and bool(tables.intersection(_LEGACY_SCHEMA))
            )
            if needs_baseline and not _has_legacy_schema(connection):
                raise RuntimeError(
                    "Existing database schema does not match the supported legacy "
                    "baseline; back up the database and migrate it explicitly."
                )
    finally:
        migration_engine.dispose()
    if needs_baseline:
        command.stamp(config, "001_foundation")
    command.upgrade(config, "head")
    logger.info("Database initialized (%s)", _database_url().split("://")[0])
