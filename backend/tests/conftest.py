import os
import sys
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("SECRET_KEY", "test-only-signing-key-" + "x" * 32)
os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{Path(tempfile.mkdtemp(prefix='kaligpt-tests-')) / 'default.db'}",
)

from db import models  # noqa: E402,F401
from db.base import Base  # noqa: E402


@pytest.fixture
def database_session(tmp_path):
    database_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{database_path}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, future=True)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
