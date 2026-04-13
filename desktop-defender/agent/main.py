"""
Desktop Defender Local Security Agent API
Defensive-only local monitoring, alerting, and containment hooks.
Author: sashasmith-syber
"""

from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import os
import uuid
import hashlib
import psutil

APP_VERSION = "1.0.0"

# Generate or load secure agent token
def get_agent_token():
    """Get or generate secure agent token"""
    # First, check environment variable
    env_token = os.getenv("DESKTOP_DEFENDER_AGENT_TOKEN")
    if env_token:
        return env_token
    
    # Check for existing token file
    token_file = os.path.expanduser("~/.desktop-defender-agent-token")
    if os.path.exists(token_file):
        with open(token_file, "r") as f:
            return f.read().strip()
    
    # Generate new secure token
    new_token = f"dd_{secrets.token_urlsafe(32)}"
    
    # Save to file with restricted permissions
    try:
        with open(token_file, "w") as f:
            f.write(new_token)
        # Set restrictive permissions (owner read/write only)
        os.chmod(token_file, 0o600)
    except Exception as e:
        logger.warning(f"Could not save token to file: {e}")
    
    # Log the token securely - only show once at startup
    print("\n" + "=" * 70)
    print("DESKTOP DEFENDER AGENT TOKEN GENERATED - SECURE THIS IMMEDIATELY")
    print("=" * 70)
    print(f"Token: {new_token}")
    print(f"Token file: {token_file}")
    print("=" * 70)
    print("⚠️  ACTION REQUIRED: Save this token in your environment or client configuration!")
    print("⚠️  This token will NOT be shown again!")
    print("=" * 70 + "\n")
    
    logger.critical("=" * 70)
    logger.critical("DESKTOP DEFENDER AGENT TOKEN GENERATED - SECURE THIS IMMEDIATELY")
    logger.critical("=" * 70)
    logger.critical(f"Token: {new_token}")
    logger.critical(f"Token file: {token_file}")
    logger.critical("=" * 70)
    logger.critical("⚠️  ACTION REQUIRED: Save this token in your environment or client configuration!")
    logger.critical("⚠️  This token will NOT be shown again!")
    logger.critical("=" * 70)
    
    return new_token

AGENT_TOKEN = get_agent_token()

app = FastAPI(title="Desktop Defender Agent", version=APP_VERSION)

class Policy(BaseModel):
    mode: str = Field(default="alert", pattern="^(monitor|alert|contain)$")
    monitorProcesses: bool = True
    monitorFiles: bool = True
    monitorLogins: bool = True
    autoContainHighRisk: bool = False

class Incident(BaseModel):
    id: str
    timestamp: str
    severity: str
    type: str
    summary: str
    details: Dict[str, Any] = Field(default_factory=dict)

CURRENT_POLICY = Policy()
INCIDENTS: List[Incident] = []
AUDIT_LOG: List[Dict[str, Any]] = []

WATCH_PATHS = [
    os.path.expanduser("~\\Desktop"),
    os.path.expanduser("~\\Documents")
]

SUSPICIOUS_PROCESS_NAMES = {
    "mimikatz.exe",
    "pwdump.exe",
    "procdump.exe"
}

def require_token(x_agent_token: Optional[str] = Header(default=None)):
    if not x_agent_token or x_agent_token != AGENT_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid agent token")
    return True

def audit(action: str, payload: Dict[str, Any]):
    AUDIT_LOG.append({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "action": action,
        "payload": payload
    })
    if len(AUDIT_LOG) > 1000:
        del AUDIT_LOG[:200]

def add_incident(severity: str, incident_type: str, summary: str, details: Dict[str, Any]):
    incident = Incident(
        id=str(uuid.uuid4()),
        timestamp=datetime.utcnow().isoformat(),
        severity=severity,
        type=incident_type,
        summary=summary,
        details=details
    )
    INCIDENTS.insert(0, incident)
    if len(INCIDENTS) > 2000:
        del INCIDENTS[1800:]
    return incident

def hash_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

@app.get("/health")
def health(_: bool = Depends(require_token)):
    return {
        "status": "healthy",
        "version": APP_VERSION,
        "policy_mode": CURRENT_POLICY.mode,
        "incident_count": len(INCIDENTS),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/incidents")
def list_incidents(_: bool = Depends(require_token)):
    return {"incidents": [i.model_dump() for i in INCIDENTS[:200]]}

@app.get("/audit")
def list_audit(_: bool = Depends(require_token)):
    return {"audit": AUDIT_LOG[-300:]}

@app.get("/policy")
def get_policy(_: bool = Depends(require_token)):
    return CURRENT_POLICY.model_dump()

@app.post("/policy")
def set_policy(policy: Policy, _: bool = Depends(require_token)):
    global CURRENT_POLICY
    CURRENT_POLICY = policy
    audit("policy.updated", policy.model_dump())
    return {"ok": True, "policy": CURRENT_POLICY.model_dump()}

@app.post("/scan/quick")
def quick_scan(_: bool = Depends(require_token)):
    findings = 0

    if CURRENT_POLICY.monitorProcesses:
        for proc in psutil.process_iter(["name", "pid", "username"]):
            name = (proc.info.get("name") or "").lower()
            if name in SUSPICIOUS_PROCESS_NAMES:
                findings += 1
                add_incident(
                    severity="high",
                    incident_type="suspicious_process",
                    summary=f"Suspicious process detected: {name}",
                    details=proc.info
                )

    if CURRENT_POLICY.monitorFiles:
        for base in WATCH_PATHS:
            if not os.path.isdir(base):
                continue
            for root, _dirs, files in os.walk(base):
                for f in files[:50]:
                    full_path = os.path.join(root, f)
                    try:
                        if f.lower().endswith((".exe", ".dll", ".ps1", ".bat")):
                            findings += 1
                            add_incident(
                                severity="medium",
                                incident_type="sensitive_file_presence",
                                summary=f"Sensitive executable/script discovered: {full_path}",
                                details={"path": full_path, "sha256": hash_file(full_path)}
                            )
                    except Exception:
                        continue

    if CURRENT_POLICY.mode == "contain" and CURRENT_POLICY.autoContainHighRisk:
        high = [i for i in INCIDENTS[:20] if i.severity == "high"]
        if high:
            audit("containment.triggered", {"count": len(high), "mode": CURRENT_POLICY.mode})

    audit("scan.quick", {"findings": findings})
    return {"ok": True, "findings": findings}

@app.post("/contain/process/{pid}")
def contain_process(pid: int, _: bool = Depends(require_token)):
    if CURRENT_POLICY.mode != "contain":
        raise HTTPException(status_code=403, detail="Containment is disabled unless mode=contain")

    try:
        proc = psutil.Process(pid)
        name = proc.name()
        proc.suspend()
        add_incident(
            severity="high",
            incident_type="process_contained",
            summary=f"Process suspended: {name} ({pid})",
            details={"pid": pid, "name": name}
        )
        audit("contain.process_suspend", {"pid": pid, "name": name})
        return {"ok": True, "action": "suspended", "pid": pid, "name": name}
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/contain/firewall-block")
def firewall_block(payload: Dict[str, Any], _: bool = Depends(require_token)):
    """
    Defensive hook only. No offensive behavior.
    On Windows this endpoint is a dry-run by default for safety.
    """
    if CURRENT_POLICY.mode != "contain":
        raise HTTPException(status_code=403, detail="Containment is disabled unless mode=contain")

    ip = payload.get("ip")
    if not ip:
        raise HTTPException(status_code=400, detail="ip is required")

    audit("contain.firewall_block.requested", {"ip": ip, "dry_run": True})
    add_incident(
        severity="medium",
        incident_type="containment_firewall_hook",
        summary=f"Firewall block requested for {ip} (dry-run)",
        details={"ip": ip, "dry_run": True}
    )
    return {"ok": True, "dry_run": True, "ip": ip}

@app.get("/")
def root():
    return {"service": "desktop-defender-agent", "author": "sashasmith-syber", "version": APP_VERSION}
