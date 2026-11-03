import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]


def _compose_config(env_file, *flags):
    environment = os.environ.copy()
    for key in (
        "DATABASE_URL",
        "SECRET_KEY",
        "LLM_PROVIDER",
        "DB_PASSWORD",
        "BACKEND_ENV_FILE",
        "LM_STUDIO_HOST",
        "OLLAMA_HOST",
    ):
        environment.pop(key, None)
    return subprocess.run(
        [
            "docker",
            "compose",
            "--env-file",
            str(env_file),
            *flags,
            "config",
            "--format",
            "json",
        ],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        env=environment,
        timeout=30,
    )


@pytest.mark.skipif(
    shutil.which("docker") is None,
    reason="Docker Compose is not installed",
)
def test_compose_sqlite_lm_studio_and_team_profile(tmp_path):
    env_file = tmp_path / "backend.env"
    seed_password = "compose-" + "test-" + "seed-" + "password-" + "123456"
    env_file.write_text(
        "\n".join(
            [
                "SECRET_KEY=" + "x" * 40,
                "KALIGPT_ADMIN_USERNAME=composeadmin",
                "KALIGPT_ADMIN_PASSWORD=" + seed_password,
                "BACKEND_ENV_FILE=" + str(env_file),
            ]
        )
    )

    default = json.loads(_compose_config(env_file).stdout)
    backend = default["services"]["backend"]
    assert backend["environment"]["DATABASE_URL"] == "sqlite:////data/kaligpt.db"
    assert backend["environment"]["LLM_PROVIDER"] == "none"
    assert backend["environment"]["KALIGPT_ADMIN_PASSWORD"] == seed_password
    assert "ollama" not in backend["depends_on"]
    assert "ollama" not in default["services"]
    assert "postgres" not in default["services"]

    env_file.write_text(
        env_file.read_text()
        + "\nLLM_PROVIDER=lm_studio\n"
        + "LM_STUDIO_HOST=http://host.docker.internal:1234\n"
    )
    lm_studio = json.loads(_compose_config(env_file).stdout)
    assert lm_studio["services"]["backend"]["environment"]["LLM_PROVIDER"] == "lm_studio"
    assert "ollama" not in lm_studio["services"]

    team_password = "team-" + "test-" + "password-" + "12345678"
    database_url = (
        "postgresql+psycopg://kaligpt:"
        + team_password
        + "@postgres:5432/kaligpt"
    )
    env_file.write_text(
        env_file.read_text()
        + f"\nDB_PASSWORD={team_password}\nDATABASE_URL={database_url}\n"
    )
    team = json.loads(_compose_config(env_file, "--profile", "team").stdout)
    postgres = team["services"]["postgres"]
    assert postgres["environment"]["POSTGRES_PASSWORD"] == team_password
    assert "ports" not in postgres
