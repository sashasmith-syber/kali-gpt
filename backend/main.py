"""
KaliGPT Backend API
Main FastAPI application for handling chat requests and command execution
SECURITY HARDENED VERSION
"""

from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
import subprocess
import logging
from datetime import datetime
import os
from dotenv import load_dotenv

# Import security modules
from security import (
    CommandValidator, 
    SecurityContext as SecurityContextValidator,
    list_all_tools,
    get_tool_info
)
from auth import (
    User,
    UserCreate,
    UserLogin,
    Token,
    AuthService,
    APIKeyService,
    get_current_active_user,
    get_current_admin_user,
    init_default_admin,
    UserInDB
)
from rate_limit import (
    limiter,
    RateLimitConfig,
    custom_rate_limit_handler,
    get_rate_limit
)
from slowapi.errors import RateLimitExceeded
from llm import LLMService  # Import the new LLMService

# Import NET REAPER
from net_reaper import (
    NetReaperService,
    ResponseProfile,
    ThreatEvent,
    NetReaperHealth,
    BlockedIp,
    ScanResult,
    get_net_reaper_service
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.getenv("LOG_FILE", "kaligpt.log"))
    ]
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="KaliGPT API",
    description="AI-powered penetration testing assistant API - Security Hardened",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)

# CORS configuration - restricted
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    max_age=3600,
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response

# Initialize services
init_default_admin()
llm_service = LLMService()
logger.info("KaliGPT API initialized with security hardening and LLM service")

# Models
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

class ExecuteRequest(BaseModel):
    command: str
    context: SecurityContext

class ExecuteResponse(BaseModel):
    output: str
    exit_code: int
    executed_at: datetime

# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0"
    }

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Handle chat messages and generate responses using the local LLM"""
    try:
        logger.info(f"Chat request: {request.message[:100]}...")

        # Prepare history for the LLM
        history_formatted = [{"role": msg.role, "content": msg.content} for msg in request.history]

        # Generate a prompt that includes the security context
        prompt = f"""Context:
Target: {request.context.target or 'Not set'}
Scope: {request.context.scope or 'Not set'}
Authorized: {'Yes' if request.context.authorization else 'No'}

User Question: {request.message}

Based on the context, provide a helpful and safe response. If a command is relevant, suggest one.
"""

        # Generate response using LLMService
        llm_response = llm_service.generate_response(prompt, history_formatted)

        if llm_response.error:
            raise HTTPException(status_code=500, detail=llm_response.error)

        # For now, we are not parsing command suggestions from the LLM response.
        # This will be added in the next step.
        return ChatResponse(response=llm_response.content)

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute", response_model=ExecuteResponse)
@limiter.limit(get_rate_limit("execute"))
async def execute_command(
    request: Request,
    execute_req: ExecuteRequest,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Execute security tool commands - REQUIRES AUTHENTICATION"""
    try:
        logger.info(f"Execute request from user {current_user.username}: {execute_req.command}")
        
        if not execute_req.context.authorization:
            raise HTTPException(
                status_code=403,
                detail="Authorization not granted in security context"
            )
        
        if not execute_req.context.target:
            raise HTTPException(
                status_code=400,
                detail="Target not specified in security context"
            )
        
        is_valid, message = SecurityContextValidator.validate_target(execute_req.context.target)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid target: {message}")
        
        if execute_req.context.scope:
            is_valid, message = SecurityContextValidator.validate_scope(execute_req.context.scope)
            if not is_valid:
                raise HTTPException(status_code=400, detail=f"Invalid scope: {message}")
        
        is_valid, parsed_args, error_message = CommandValidator.validate_command(execute_req.command)
        if not is_valid:
            logger.warning(f"Command validation failed for user {current_user.username}: {error_message}")
            raise HTTPException(status_code=400, detail=f"Command validation failed: {error_message}")
        
        try:
            max_timeout = int(os.getenv("MAX_COMMAND_TIMEOUT", "300"))
            
            result = subprocess.run(
                parsed_args, 
                capture_output=True,
                text=True,
                timeout=max_timeout,
                cwd=os.path.expanduser("~"),
                shell=False
            )
            
            output = result.stdout if result.stdout else result.stderr
            output = CommandValidator.sanitize_output(output)
            
            logger.info(
                f"Command executed by {current_user.username} | "
                f"Command: {execute_req.command} | "
                f"Target: {execute_req.context.target} | "
                f"Exit code: {result.returncode}"
            )
            
            return ExecuteResponse(
                output=output,
                exit_code=result.returncode,
                executed_at=datetime.now()
            )
            
        except subprocess.TimeoutExpired:
            logger.warning(f"Command timeout for user {current_user.username}: {execute_req.command}")
            raise HTTPException(status_code=408, detail="Command execution timeout")
        except FileNotFoundError:
            logger.error(f"Command not found: {parsed_args[0]}")
            raise HTTPException(status_code=404, detail=f"Command not found: {parsed_args[0]}")
        except Exception as e:
            logger.error(f"Execution error for user {current_user.username}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in execute endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tools")
async def list_tools_endpoint():
    """List available security tools"""
    return list_all_tools()

@app.get("/api/tool/{tool_name}")
async def get_tool_info_endpoint(tool_name: str):
    """Get information about a specific tool"""
    return get_tool_info(tool_name)

# ==================== NET REAPER API ENDPOINTS ====================

# Initialize Net Reaper service
net_reaper = get_net_reaper_service()
logger.info("NET REAPER Service activated - Owner: sashasmith-syber")

@app.get("/net-reaper/health", response_model=NetReaperHealth)
async def net_reaper_health():
    """Get NET REAPER health status"""
    return net_reaper.get_health()

@app.get("/net-reaper/profile")
async def net_reaper_profile():
    """Get current NET REAPER profile info"""
    return net_reaper.get_profile_info()

@app.post("/net-reaper/api/profile")
async def net_reaper_switch_profile(profile_data: dict):
    """Switch NET REAPER response profile"""
    profile_name = profile_data.get("profile", "defensive")
    try:
        profile = ResponseProfile(profile_name)
        success, message = net_reaper.switch_profile(profile)
        if success:
            return {"success": True, "profile": profile.value, "message": message}
        else:
            raise HTTPException(status_code=400, detail=message)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid profile: {profile_name}")

@app.post("/net-reaper/api/block")
async def net_reaper_block_ip(block_data: dict):
    """Block an IP address"""
    ip = block_data.get("ip")
    reason = block_data.get("reason", "Manual block from Command Center")
    
    if not ip:
        raise HTTPException(status_code=400, detail="IP address required")
    
    success, message = net_reaper.block_ip(ip, reason)
    if success:
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=400, detail=message)

@app.post("/net-reaper/api/unblock")
async def net_reaper_unblock_ip(unblock_data: dict):
    """Unblock an IP address"""
    ip = unblock_data.get("ip")
    
    if not ip:
        raise HTTPException(status_code=400, detail="IP address required")
    
    success, message = net_reaper.unblock_ip(ip)
    if success:
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=400, detail=message)

@app.post("/net-reaper/api/scan")
async def net_reaper_scan_ip(scan_data: dict):
    """Perform authorized reconnaissance scan"""
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
                "timestamp": scan_result.timestamp
            }
        }
    else:
        raise HTTPException(status_code=400, detail=message)

@app.get("/net-reaper/blocked")
async def net_reaper_blocked_ips():
    """Get list of blocked IPs"""
    blocked = net_reaper.get_blocked_ips()
    return {
        "success": True,
        "blocked_ips": [
            {
                "ip": b.ip,
                "reason": b.reason,
                "timestamp": b.timestamp,
                "blocked_by": b.blocked_by
            }
            for b in blocked
        ],
        "count": len(blocked)
    }

@app.post("/net-reaper/api/threat")
async def net_reaper_process_threat(threat_data: dict):
    """Process a threat event"""
    try:
        event = net_reaper.process_threat(threat_data)
        return {
            "success": event.success,
            "event": {
                "timestamp": event.timestamp,
                "risk_level": event.risk_level,
                "threat_type": event.threat_type,
                "action_taken": event.action_taken,
                "profile": event.profile
            }
        }
    except Exception as e:
        logger.error(f"Failed to process threat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
