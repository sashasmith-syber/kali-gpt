# Desktop Defender (Defensive-Only)
Author: sashasmith-syber

Desktop Defender is a local-first desktop security application using Electron + React (UI) and a Python FastAPI local agent for defensive monitoring and containment hooks.

## Security Scope

This project is strictly defensive:
- Monitoring
- Alerting
- Containment hooks
- Audit logging

Not included:
- Offensive or retaliatory actions
- Unauthorized intrusion behavior

## Architecture

- `electron/` - Desktop shell + secure preload bridge
- `renderer/` - React UI
- `agent/` - Local Python security agent API

## Critical-Path Capabilities

- Agent health and authenticated local API access
- Policy modes: `monitor`, `alert`, `contain`
- Incident list and audit trail
- Quick scan for suspicious process names and sensitive executable/script presence
- Containment actions:
  - Process suspend by PID (only in `contain` mode)
  - Firewall block hook (dry-run)

## Run Instructions

### 1) Start Python Agent

```bash
cd desktop-defender/agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set DESKTOP_DEFENDER_AGENT_TOKEN=change-me-local-token
uvicorn main:app --host 127.0.0.1 --port 8787
```

### 2) Start Electron App

In a separate terminal:

```bash
cd desktop-defender
npm install
npm run dev
```

## API (Critical Endpoints)

- `GET /health` (auth required)
- `GET /incidents` (auth required)
- `GET /audit` (auth required)
- `GET /policy` (auth required)
- `POST /policy` (auth required)
- `POST /scan/quick` (auth required)
- `POST /contain/process/{pid}` (auth required, mode=contain)
- `POST /contain/firewall-block` (auth required, mode=contain, dry-run)

Header required:
- `X-Agent-Token: <token>`

## Hardening Notes

- Localhost-only API (`127.0.0.1`)
- Header token auth required for agent operations
- Mode-gated containment
- Audit records for policy updates, scans, containment requests

## Attribution

All Desktop Defender code and docs in this module are marked with:
`Author: sashasmith-syber`
