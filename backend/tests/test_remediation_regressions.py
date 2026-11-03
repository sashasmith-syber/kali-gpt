import asyncio
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from alembic.config import Config
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect

import auth
import db.session as db_session
from db.base import Base
from db.models.user import UserRecord


def _admin_env(monkeypatch, *, username="admin", email="admin@example.com"):
    monkeypatch.setenv("KALIGPT_ADMIN_USERNAME", username)
    monkeypatch.setenv("KALIGPT_ADMIN_EMAIL", email)
    monkeypatch.setenv("KALIGPT_ADMIN_PASSWORD", "StrongSeedPassword123!")


def test_admin_seed_validation_is_atomic(database_session, monkeypatch):
    _admin_env(monkeypatch, username="admin.local")

    with pytest.raises(ValueError, match="username"):
        auth.init_default_admin(database_session)

    assert database_session.query(UserRecord).count() == 0


def test_admin_seed_validates_email_before_persistence(database_session, monkeypatch):
    _admin_env(monkeypatch, email="not-an-email")

    with pytest.raises(ValueError, match="email"):
        auth.init_default_admin(database_session)

    assert database_session.query(UserRecord).count() == 0


def test_invalid_admin_password_is_not_in_startup_error(database_session, monkeypatch):
    weak_password = "weaklowercasepassword"
    monkeypatch.setenv("KALIGPT_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("KALIGPT_ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("KALIGPT_ADMIN_PASSWORD", weak_password)

    with pytest.raises(ValueError) as error:
        auth.init_default_admin(database_session)

    assert weak_password not in str(error.value)
    assert database_session.query(UserRecord).count() == 0


def test_admin_seed_commit_failure_rolls_back(database_session, monkeypatch):
    _admin_env(monkeypatch)

    def fail_commit():
        raise RuntimeError("database write failed")

    monkeypatch.setattr(database_session, "commit", fail_commit)
    with pytest.raises(RuntimeError, match="database write failed"):
        auth.init_default_admin(database_session)

    monkeypatch.undo()
    assert database_session.query(UserRecord).count() == 0


def test_user_create_rejects_invalid_username_before_database_write(database_session):
    with pytest.raises(ValidationError):
        auth.UserCreate.model_validate({
            "username": "bad name",
            "email": "valid@example.com",
            "password": "StrongPassword123!",
        })

    assert database_session.query(UserRecord).count() == 0


def test_api_key_expiration_handles_naive_and_aware_datetimes():
    future = datetime.now(timezone.utc) + timedelta(days=1)
    past = datetime.now(timezone.utc) - timedelta(days=1)

    assert not auth._is_expired(future)
    assert not auth._is_expired(future.replace(tzinfo=None))
    assert auth._is_expired(past)
    assert auth._is_expired(past.replace(tzinfo=None))


def test_llm_discovery_timeouts_are_capped():
    from llm import LLMConfig, OllamaProvider

    provider = OllamaProvider(
        LLMConfig(
            provider="ollama",
            host="http://localhost:11434",
            model="test",
            connect_timeout=120,
            timeout=120,
        )
    )

    assert provider._discovery_timeout() == (2, 5)


def test_admin_rbac_remains_enforced_and_provider_logs_hide_url_credentials(caplog):
    from fastapi import HTTPException
    from llm import build_provider

    viewer = auth.UserInDB(username="viewer1", email="viewer@example.com", role="viewer")
    admin_only = auth.require_roles("admin")

    async def verify_role():
        with pytest.raises(HTTPException) as error:
            await admin_only(viewer)
        assert error.value.status_code == 403

    asyncio.run(verify_role())
    caplog.set_level("INFO")
    build_provider(
        provider="ollama",
        host="http://user:" + "credential-" + "test-value@localhost",
    )

    assert "credential-test-value" not in caplog.text


def test_secret_key_is_required_at_import():
    environment = os.environ.copy()
    environment.pop("SECRET_KEY", None)
    environment.pop("PYTHONPATH", None)
    result = subprocess.run(
        [sys.executable, "-c", "import auth"],
        cwd=Path(__file__).resolve().parents[1],
        env=environment,
        capture_output=True,
        text=True,
        timeout=10,
    )

    assert result.returncode != 0
    assert "deployment-specific value" in result.stderr


def test_alembic_url_percent_escaping_round_trips():
    encoded_credential = "p%40ss%25word"
    database_url = (
        "postgresql+psycopg://user:" + encoded_credential + "@localhost/db"
    )
    config = Config()

    config.set_main_option(
        "sqlalchemy.url", db_session._escape_configparser_percent(database_url)
    )

    assert config.get_main_option("sqlalchemy.url") == database_url


def test_migrations_initialize_fresh_and_repeated_databases(tmp_path, monkeypatch):
    database_path = tmp_path / "fresh.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")

    db_session.init_db()
    db_session.init_db()

    engine = create_engine(f"sqlite:///{database_path}")
    try:
        inspector = inspect(engine)
        assert {"users", "api_keys", "app_settings", "alembic_version"}.issubset(
            inspector.get_table_names()
        )
    finally:
        engine.dispose()


def test_migrations_baseline_only_matching_legacy_schema(tmp_path, monkeypatch):
    database_path = tmp_path / "legacy.db"
    database_url = f"sqlite:///{database_path}"
    legacy_engine = create_engine(database_url)
    Base.metadata.create_all(bind=legacy_engine)
    legacy_engine.dispose()
    monkeypatch.setenv("DATABASE_URL", database_url)

    db_session.init_db()

    engine = create_engine(database_url)
    try:
        assert "alembic_version" in inspect(engine).get_table_names()
    finally:
        engine.dispose()


def test_incompatible_legacy_database_is_not_stamped(tmp_path, monkeypatch):
    database_path = tmp_path / "incompatible.db"
    database_url = f"sqlite:///{database_path}"
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(50))"
        )
        connection.exec_driver_sql(
            "INSERT INTO users (username) VALUES ('preserved')"
        )
    engine.dispose()
    monkeypatch.setenv("DATABASE_URL", database_url)

    with pytest.raises(RuntimeError, match="does not match"):
        db_session.init_db()

    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        assert "alembic_version" not in inspector.get_table_names()
        with engine.connect() as connection:
            assert connection.exec_driver_sql(
                "SELECT username FROM users"
            ).scalar_one() == "preserved"
    finally:
        engine.dispose()


def test_llm_discovery_is_offloaded_and_concurrency_bounded(monkeypatch):
    import main

    active = 0
    maximum_active = 0
    lock = threading.Lock()

    def blocked_probe():
        nonlocal active, maximum_active
        with lock:
            active += 1
            maximum_active = max(maximum_active, active)
        time.sleep(0.08)
        with lock:
            active -= 1
        return ["model"]

    def blocked_health():
        from llm import LLMHealth

        with lock:
            nonlocal active, maximum_active
            active += 1
            maximum_active = max(maximum_active, active)
        time.sleep(0.08)
        with lock:
            active -= 1
        return LLMHealth(
            provider="ollama",
            host="local",
            reachable=True,
            model="model",
            status="up",
        )

    monkeypatch.setattr(main.llm_service, "list_models", blocked_probe)
    monkeypatch.setattr(main.llm_service, "health", blocked_health)

    async def verify():
        tasks = [
            asyncio.create_task(main.llm_models(None))
            for _ in range(4)
        ]
        tasks.append(asyncio.create_task(main.llm_health(None)))
        tasks.append(asyncio.create_task(main.health_check()))
        await asyncio.sleep(0.01)
        assert any(not task.done() for task in tasks)
        results = await asyncio.gather(*tasks)
        assert all(result["models"] == ["model"] for result in results[:4])

    asyncio.run(verify())
    assert maximum_active <= 2
    assert maximum_active >= 1


def test_chat_generation_does_not_block_the_event_loop(monkeypatch):
    import main
    from llm import LLMResponse

    user = auth.UserInDB(username="operator1", email="operator@example.com")
    request = main.ChatRequest(
        message="hello",
        context=main.SecurityContext(),
        history=[],
    )

    def blocked_generation(_prompt, _history):
        time.sleep(0.08)
        return LLMResponse(content="response", model="test", generated_at="")

    monkeypatch.setattr(
        main.llm_service, "generate_response", blocked_generation
    )

    async def verify():
        task = asyncio.create_task(main.chat(request, user))
        await asyncio.sleep(0.01)
        assert not task.done()
        return await task

    assert asyncio.run(verify()).response == "response"
