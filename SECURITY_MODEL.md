# kali-gpt threat model

Repository: `sashasmith-syber/kali-gpt`. Builds on `SECURITY.md` (disclosure policy, in/out-of-scope list, CI controls). No separate infrastructure repository; deployment is `docker-compose.yml` + `backend/Dockerfile` in this repo.

## User-provided facts (these drive finding priorities)
- **Deployment:** single operator, runs only on their own machine/VM (localhost). Not intended to be reachable by others. *(user answer)*
- **Attackers in scope:** all of them — unauthenticated network attackers, malicious websites in the operator's browser (CSRF, DNS rebinding against localhost services), authenticated users exceeding allowed tools/args, prompt injection via LLM or scan-target output, supply chain (deps, CI). The user's bar: "this is a red team tool, it must be unbreakable." *(user answer)*
- **Offensive-tool execution by design:** not settled — treat running Kali tools against arbitrary targets as **in scope** (not accepted risk). *(user answer)*
- **Out of scope (SECURITY.md):** vulnerabilities in third-party dependencies themselves (report upstream, tracked by Dependabot), social engineering of contributors, physical security.
- Net effect: nothing ruled out except the SECURITY.md exclusions. Localhost-only lowers *likelihood* of remote-network attacks only where code actually binds to loopback; it does not remove browser-based (CSRF/DNS-rebinding) or local-process attackers.

## Components
| Component | Code | Notes |
|---|---|---|
| **Backend API** | `backend/main.py`, `backend/llm.py`, `backend/rate_limit.py`, `backend/incident_validation.py` | FastAPI, uvicorn `--host 0.0.0.0 --port 8000 --reload`; CORS from `ALLOWED_ORIGINS` |
| **Auth** | `backend/auth.py` | JWT (HS256, `SECRET_KEY = secrets.token_urlsafe(32)` per process), in-memory `users_db`, random default `admin` password, API keys |
| **Command Execution** | `backend/security.py` (`ALLOWED_TOOLS`, `CommandValidator`, `SecurityContextValidator`), `/api/execute` in `backend/main.py` | `subprocess.run(shell=False)` of allow-listed Kali tools as the container user, `cwd=~` |
| **Net-Reaper** | `backend/net_reaper.py`, `/net-reaper/*` routes in `backend/main.py`, `Net-Reaper-Claude Integration Architecture/app` (React dashboard) | block/unblock IPs, counter-scan (`_counter_scan` via `subprocess.Popen`), profile switching; routes take raw `dict` bodies |
| **Web Frontend** | `backend/frontend/` (React/Vite on :5173) | talks to backend at `VITE_API_BASE_URL` |
| **Desktop Defender** | `desktop-defender/electron/`, `desktop-defender/renderer/`, `desktop-defender/agent/main.py` | Electron (contextIsolation on, nodeIntegration off, preload exposes `config:get`/`config:set`); local agent on `127.0.0.1:8787` with `X-Agent-Token`; can suspend processes (`/contain/process/{pid}`) |
| **Infrastructure & CI** | `docker-compose.yml`, `backend/Dockerfile`, `backend/frontend/Dockerfile`, `.github/workflows/`, `.github/dependabot.yml`, root scripts (`activate_offensive_mode.py`, `*_test*.py`, `start_deployment.bat`) | backend mounts `/var/run/docker.sock`; ports 8000/5173/11434 published on all interfaces |

## Trust boundaries and entry points
1. **Browser → Backend API (:8000).** `/api/chat`, `/api/tools`, `/health`, and the `/net-reaper/*` routes have no auth dependency in `main.py`; `/api/execute` requires a JWT (`get_current_active_user`). Reachable by any origin's browser requests (simple POSTs, DNS rebinding) and, because compose publishes `8000:8000` on `0.0.0.0`, by the LAN unless host firewall blocks it.
2. **Backend → host.** `/var/run/docker.sock` is mounted into the backend container → backend RCE = host root. Kali tools (`nmap`, `hydra`, `metasploit`, `sqlmap`, …) run inside the container.
3. **LLM / tool output → operator and commands.** `/api/chat` interpolates user message, target and scope into the prompt sent to Ollama (`:11434`, unauthenticated, published). LLM responses and tool output (from attacker-controlled targets) are rendered in the frontends and may be turned into commands.
4. **Electron renderer → main process → local agent.** Renderer can read/write `agentToken`/`agentBaseUrl` via IPC; agent token guards process suspension and policy changes.
5. **Supply chain.** npm (three Node projects) and pip deps, GitHub Actions workflows (pinned SHAs per workflow header).

## Assets
- **Host machine** (via docker.sock and Kali tooling) — most critical.
- **Operator's authority to attack targets** — misuse means unauthorized attacks launched from the operator's IP.
- JWT signing key, admin password, API keys, agent token, `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` in `.env`.
- Engagement data: targets, scope, command output, logs (`LOG_FILE`), incidents/audit logs.
- Integrity of Net-Reaper blocklist / Desktop Defender containment (DoS of the operator's own machine).

## Existing controls
`CommandValidator` allow-list + `shell=False`; target/scope validation; JWT on `/api/execute`; slowapi rate limit; security headers middleware; CORS allow-list; bcrypt; Electron context isolation; agent token; CI: CodeQL, pip-audit, npm audit, gitleaks, dependency review, Dependabot.

## Open questions
- Should `/api/execute` restrict targets (e.g. scope file) or is any target acceptable for the operator?
- Is the docker.sock mount needed?
- Should Ollama/backend be bound to `127.0.0.1` in compose?
