"""
Rate limiting configuration for KaliGPT API
Protects against DoS attacks and abuse
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
import logging

logger = logging.getLogger(__name__)


def get_user_identifier(request: Request) -> str:
    """
    Get identifier for rate limiting
    Uses authenticated user if available, otherwise IP address
    """
    # Try to get user from request state (set by auth middleware)
    if hasattr(request.state, "user"):
        user = request.state.user
        if user:
            identifier = f"user:{user.username}"
            logger.debug(f"Rate limit identifier: {identifier}")
            return identifier
    
    # Fall back to IP address
    ip = get_remote_address(request)
    identifier = f"ip:{ip}"
    logger.debug(f"Rate limit identifier: {identifier}")
    return identifier


# Initialize limiter
limiter = Limiter(
    key_func=get_user_identifier,
    default_limits=["100/hour"],  # Default: 100 requests per hour
    storage_uri="memory://",  # Use memory storage (replace with Redis in production)
    strategy="fixed-window",
    headers_enabled=True,
)


# Rate limit configurations for different endpoint types
RATE_LIMITS = {
    # Authentication endpoints - stricter limits to prevent brute force
    "auth_login": "5/minute",
    "auth_register": "3/hour",
    "auth_refresh": "10/hour",
    
    # Chat endpoints - moderate limits
    "chat": "30/minute",
    "chat_history": "60/minute",
    
    # Command execution - strict limits due to resource intensity
    "execute": "10/minute",
    "execute_heavy": "5/minute",
    
    # Tool information - lenient limits
    "tools_list": "100/minute",
    "tools_info": "100/minute",
    
    # Health check - very lenient
    "health": "1000/minute",
    
    # Admin endpoints - moderate limits
    "admin": "50/minute",
}


def get_rate_limit(endpoint_type: str) -> str:
    """Get rate limit for specific endpoint type"""
    return RATE_LIMITS.get(endpoint_type, "100/hour")


class RateLimitConfig:
    """Rate limit configuration helper"""
    
    @staticmethod
    def get_limiter():
        """Get configured limiter instance"""
        return limiter
    
    @staticmethod
    def get_limit_for_endpoint(endpoint: str) -> str:
        """Get rate limit string for endpoint"""
        return get_rate_limit(endpoint)
    
    @staticmethod
    def log_rate_limit_exceeded(request: Request, endpoint: str):
        """Log rate limit exceeded events"""
        identifier = get_user_identifier(request)
        logger.warning(
            f"Rate limit exceeded - Endpoint: {endpoint}, "
            f"Identifier: {identifier}, "
            f"IP: {get_remote_address(request)}"
        )


# Custom rate limit exceeded handler
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded"""
    endpoint = request.url.path
    RateLimitConfig.log_rate_limit_exceeded(request, endpoint)
    
    return _rate_limit_exceeded_handler(request, exc)
