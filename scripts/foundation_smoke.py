#!/usr/bin/env python3
"""Foundation smoke: migrate/init DB, seed admin, login, LLM health, chat without LLM."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

# Isolate smoke DB from developer data
smoke_dir = Path(tempfile.mkdtemp(prefix="kaligpt-smoke-"))
db_path = smoke_dir / "kaligpt.db"
os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
os.environ["SECRET_KEY"] = "foundation-smoke-secret-key-32b"
os.environ["KALIGPT_ADMIN_PASSWORD"] = "FoundationSmokePass1!"
os.environ["KALIGPT_ADMIN_USERNAME"] = "admin"
os.environ["LLM_PROVIDER"] = "ollama"
os.environ["OLLAMA_HOST"] = "http://127.0.0.1:9"  # intentionally unreachable

from fastapi.testclient import TestClient  # noqa: E402
import main as app_module  # noqa: E402


def main() -> int:
    with TestClient(app_module.app) as client:
        health = client.get("/health")
        assert health.status_code == 200, health.text
        body = health.json()
        assert body["status"] == "healthy"
        assert "llm" in body
        print("OK /health", body["llm"]["status"])

        bad = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert bad.status_code == 401

        login = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "FoundationSmokePass1!"},
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("OK /api/auth/login")

        me = client.get("/api/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["role"] == "admin"
        print("OK /api/auth/me")

        llm = client.get("/api/llm/health", headers=headers)
        assert llm.status_code == 200
        assert llm.json()["status"] in ("down", "up", "unconfigured")
        print("OK /api/llm/health", llm.json()["status"])

        chat = client.post(
            "/api/chat",
            headers=headers,
            json={
                "message": "hello",
                "context": {"authorization": False},
                "history": [],
            },
        )
        assert chat.status_code == 200, chat.text
        assert chat.json().get("llm_available") is False
        print("OK /api/chat degradation")

        denied = client.post(
            "/api/execute",
            headers=headers,
            json={
                "command": "nmap -h",
                "context": {"authorization": False, "target": "127.0.0.1"},
            },
        )
        assert denied.status_code == 403
        print("OK /api/execute authz gate")

    print("Foundation smoke passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
