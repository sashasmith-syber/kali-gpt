"""
KaliGPT Backend API
FastAPI application — Foundation (hybrid local-first)
"""

from contextlib import asynccontextmanager
from fastapi import Body, FastAPI, HTTPException, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import asyncio
import subprocess
import logging
from datetime import datetime
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env before local imports bind SECRET_KEY / DATABASE_URL
load_dotenv(Path(__file__).resolve().parent / ".env")

from security import (
    CommandValidator,
    SecurityContext as SecurityContextValidator,
    list_all_tools,
    get_tool_info,
)
from auth import (
    UserCreate,
    UserLogin,
    Token,
    AuthService,
    get_current_active_user,
    get_current_admin_user,
    require_roles,
    init_default_admin,
    UserInDB,
)
from rate_limit import (
    limiter,
    custom_rate_limit_handler,
    get_rate_limit,
)
from slowapi.errors import RateLimitExceeded
from llm import LLMService, LLMHealth
from db.session import init_db, SessionLocal
from db.models.user import AppSetting

from net_reaper import (
    ResponseProfile,
    get_net_reaper_service,
    NetReaperHealth,
)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.getenv("LOG_FILE", "kaligpt.log")),
    ],
)
logger = logging.getLogger(__name__)

llm_service = LLMService()
net_reaper = get_net_reaper_service()


def _load_llm_settings_from_db() -> None:
    db = SessionLocal()
    try:
        rows = {
            r.key: r.value
            for r in db.query(AppSetting).filter(
                AppSetting.key.in_(["llm.provider", "llm.host", "llm.model"])
            )
        }
        if not rows:
            return
        provider = rows.get("llm.provider")
        host = rows.get("llm.host")
        model = rows.get("llm.model")
        llm_service.reload(provider=provider, host=host, model=model)
    finally:
        db.close()


def _save_llm_setting(key: str, value: str) -> None:
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == key).one_or_none()
        if row:
            row.value = value
            row.updated_at = datetime.utcnow()
        else:
            db.add(AppSetting(key=key, value=value, updated_at=datetime.utcnow()))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    init_default_admin()
    _load_llm_settings_from_db()
    logger.info("KaliGPT Foundation API ready")
    yield


app = FastAPI(
    title="KaliGPT API",
    description="AI-powered penetration testing assistant API — Foundation",
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)

allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    max_age=3600,
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response


class Message(BaseModel):
    id: str
    role: str
    content: str
    timestamp: datetime


class SecurityContext(BaseModel):
    target: Optional[str] = None
    scope: Optional[str] = None
    authorization: bool = False


class ChatRequest(BaseModel):
    message: str
    context: SecurityContext
    history: List[Message] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
    command_suggestion: Optional[Dict[str, Any]] = None
    llm_available: bool = True


class ExecuteRequest(BaseModel):
    command: str
    context: SecurityContext


class ExecuteResponse(BaseModel):
    output: str
    exit_code: int
    executed_at: datetime


class LLMConfigUpdate(BaseModel):
    provider: Optional[str] = None
    host: Optional[str] = None
    model: Optional[str] = None


@app.get("/health")
async def health_check():
    # Probe off the event loop; LLM health uses a short timeout (see llm.py)
    llm = await asyncio.to_thread(llm_service.health)
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.1.0",
        "llm": {
            "status": llm.status,
            "provider": llm.provider,
            "model": llm.model,
            "reachable": llm.reachable,
            "latency_ms": llm.latency_ms,
        },
    }


@app.post("/api/auth/login", response_model=Token)
@limiter.limit(get_rate_limit("auth_login"))
async def login(
    request: Request,
    response: Response,
    body: UserLogin = Body(...),
):
    user = AuthService.authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return AuthService.create_tokens(user)


@app.post("/api/auth/register", response_model=dict)
async def register_user(
    user_data: UserCreate,
    _admin: UserInDB = Depends(get_current_admin_user),
):
    try:
        user = AuthService.create_user(user_data)
        return {
            "username": user.username,
            "email": user.email,
            "role": user.role,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/auth/me")
async def auth_me(current_user: UserInDB = Depends(get_current_active_user)):
    return {
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "full_name": current_user.full_name,
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: UserInDB = Depends(require_roles("admin", "operator", "viewer")),
):
    try:
        logger.info("Chat request from %s: %s...", current_user.username, request.message[:100])
        history_formatted = [
            {"role": msg.role, "content": msg.content} for msg in request.history
        ]
        prompt = f"""Context:
Target: {request.context.target or 'Not set'}
Scope: {request.context.scope or 'Not set'}
Authorized: {'Yes' if request.context.authorization else 'No'}

User Question: {request.message}

Based on the context, provide a helpful and safe response. If a command is relevant, suggest one.
"""
        llm_response = llm_service.generate_response(prompt, history_formatted)
        if llm_response.error:
            # Graceful degradation — still 200 so UI can continue
            return ChatResponse(
                response=llm_response.content
                or "LLM is unavailable. You can still use authenticated tool execution.",
                llm_available=False,
            )
        return ChatResponse(response=llm_response.content, llm_available=True)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in chat endpoint: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Chat request failed")


@app.post("/api/execute", response_model=ExecuteResponse)
@limiter.limit(get_rate_limit("execute"))
async def execute_command(
    request: Request,
    response: Response,
    execute_req: ExecuteRequest,
    current_user: UserInDB = Depends(require_roles("admin", "operator")),
):
    try:
        logger.info(
            "Execute request from user %s: %s",
            current_user.username,
            execute_req.command,
        )

        if not execute_req.context.authorization:
            raise HTTPException(
                status_code=403,
                detail="Authorization not granted in security context",
            )

        if not execute_req.context.target:
            raise HTTPException(
                status_code=400,
                detail="Target not specified in security context",
            )

        is_valid, message = SecurityContextValidator.validate_target(
            execute_req.context.target
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid target: {message}")

        if execute_req.context.scope:
            is_valid, message = SecurityContextValidator.validate_scope(
                execute_req.context.scope
            )
            if not is_valid:
                raise HTTPException(status_code=400, detail=f"Invalid scope: {message}")

        is_valid, parsed_args, error_message = CommandValidator.validate_command(
            execute_req.command
        )
        if not is_valid:
            logger.warning(
                "Command validation failed for user %s: %s",
                current_user.username,
                error_message,
            )
            raise HTTPException(
                status_code=400, detail=f"Command validation failed: {error_message}"
            )

        try:
            max_timeout = int(os.getenv("MAX_COMMAND_TIMEOUT", "300"))
            result = subprocess.run(
                parsed_args,
                capture_output=True,
                text=True,
                timeout=max_timeout,
                cwd=os.path.expanduser("~"),
                shell=False,
            )
            output = result.stdout if result.stdout else result.stderr
            output = CommandValidator.sanitize_output(output)
            return ExecuteResponse(
                output=output,
                exit_code=result.returncode,
                executed_at=datetime.now(),
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=408, detail="Command execution timeout")
        except FileNotFoundError:
            raise HTTPException(
                status_code=404, detail=f"Command not found: {parsed_args[0]}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in execute endpoint: %s", str(e))
        raise HTTPException(status_code=500, detail="Execution error")


@app.get("/api/tools")
async def list_tools_endpoint(
    _user: UserInDB = Depends(require_roles("admin", "operator", "viewer")),
):
    return list_all_tools()


@app.get("/api/tool/{tool_name}")
async def get_tool_info_endpoint(
    tool_name: str,
    _user: UserInDB = Depends(require_roles("admin", "operator", "viewer")),
):
    return get_tool_info(tool_name)


@app.get("/api/llm/health", response_model=LLMHealth)
async def llm_health(
    _user: UserInDB = Depends(require_roles("admin", "operator", "viewer")),
):
    return llm_service.health()


@app.get("/api/llm/models")
async def llm_models(
    _user: UserInDB = Depends(require_roles("admin", "operator")),
):
    return {"models": llm_service.list_models(), "current": (
        llm_service.provider.config.model if llm_service.provider else None
    )}


@app.put("/api/llm/config")
async def llm_config_update(
    body: LLMConfigUpdate,
    _admin: UserInDB = Depends(get_current_admin_user),
):
    provider = body.provider
    host = body.host
    model = body.model
    if provider:
        _save_llm_setting("llm.provider", provider)
    if host:
        _save_llm_setting("llm.host", host)
    if model:
        _save_llm_setting("llm.model", model)

    current = llm_service.provider.config if llm_service.provider else None
    llm_service.reload(
        provider=provider or (current.provider if current else None),
        host=host or (current.host if current else None),
        model=model or (current.model if current else None),
    )
    health = llm_service.health()
    return {"success": True, "health": health.model_dump()}


# ==================== NET REAPER ====================

@app.get("/net-reaper/health", response_model=NetReaperHealth)
async def net_reaper_health():
    return net_reaper.get_health()


@app.get("/net-reaper/profile")
async def net_reaper_profile(
    _user: UserInDB = Depends(require_roles("admin", "operator", "viewer")),
):
    return net_reaper.get_profile_info()


@app.post("/net-reaper/api/profile")
async def net_reaper_switch_profile(
    profile_data: dict,
    _admin: UserInDB = Depends(get_current_admin_user),
):
    profile_name = profile_data.get("profile", "defensive")
    try:
        profile = ResponseProfile(profile_name)
        success, message = net_reaper.switch_profile(profile)
        if success:
            return {"success": True, "profile": profile.value, "message": message}
        raise HTTPException(status_code=400, detail=message)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid profile: {profile_name}")


@app.post("/net-reaper/api/block")
async def net_reaper_block_ip(
    block_data: dict,
    _admin: UserInDB = Depends(get_current_admin_user),
):
    ip = block_data.get("ip")
    reason = block_data.get("reason", "Manual block from Command Center")
    if not ip:
        raise HTTPException(status_code=400, detail="IP address required")
    success, message = net_reaper.block_ip(ip, reason)
    if success:
        return {"success": True, "message": message}
    raise HTTPException(status_code=400, detail=message)


@app.post("/net-reaper/api/unblock")
async def net_reaper_unblock_ip(
    unblock_data: dict,
    _admin: UserInDB = Depends(get_current_admin_user),
):
    ip = unblock_data.get("ip")
    if not ip:
        raise HTTPException(status_code=400, detail="IP address required")
    success, message = net_reaper.unblock_ip(ip)
    if success:
        return {"success": True, "message": message}
    raise HTTPException(status_code=400, detail=message)


@app.post("/net-reaper/api/scan")
async def net_reaper_scan_ip(
    scan_data: dict,
    _user: UserInDB = Depends(require_roles("admin", "operator")),
):
    ip = scan_data.get("ip")
    if not ip:
        raise HTTPException(status_code=400, detail="IP address required")
    success, scan_result, message = net_reaper.scan_ip(ip)
    if success and scan_result:
        return {
            "success": True,
            "scan": {
                "ip": scan_result.ip,
                "open_ports": scan_result.open_ports,
                "services": scan_result.services,
                "timestamp": scan_result.timestamp,
            },
        }
    raise HTTPException(status_code=400, detail=message)


@app.get("/net-reaper/blocked")
async def net_reaper_blocked_ips(
    _user: UserInDB = Depends(require_roles("admin", "operator", "viewer")),
):
    blocked = net_reaper.get_blocked_ips()
    return {
        "success": True,
        "blocked_ips": [
            {
                "ip": b.ip,
                "reason": b.reason,
                "timestamp": b.timestamp,
                "blocked_by": b.blocked_by,
            }
            for b in blocked
        ],
        "count": len(blocked),
    }


@app.post("/net-reaper/api/threat")
async def net_reaper_process_threat(
    threat_data: dict,
    _user: UserInDB = Depends(require_roles("admin", "operator")),
):
    try:
        event = net_reaper.process_threat(threat_data)
        return {
            "success": event.success,
            "event": {
                "timestamp": event.timestamp,
                "risk_level": event.risk_level,
                "threat_type": event.threat_type,
                "action_taken": event.action_taken,
                "profile": event.profile,
            },
        }
    except Exception as e:
        logger.error("Failed to process threat: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to process threat")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
