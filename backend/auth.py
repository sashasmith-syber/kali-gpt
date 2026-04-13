"""
Authentication and authorization module for KaliGPT
Implements JWT-based authentication with secure password hashing
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field, validator
import secrets
import logging

logger = logging.getLogger(__name__)

# Security configuration
SECRET_KEY = secrets.token_urlsafe(32)  # Generate secure random key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token scheme
security = HTTPBearer()


# Models
class User(BaseModel):
    """User model"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = None
    disabled: bool = False
    role: str = "user"  # user, admin
    created_at: datetime = Field(default_factory=datetime.now)
    
    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username must be alphanumeric (with _ or - allowed)')
        return v


class UserInDB(User):
    """User model with hashed password"""
    hashed_password: str


class UserCreate(BaseModel):
    """User registration model"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = None
    
    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserLogin(BaseModel):
    """User login model"""
    username: str
    password: str


class Token(BaseModel):
    """Token response model"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    """Token payload data"""
    username: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[datetime] = None


class APIKey(BaseModel):
    """API Key model"""
    key: str
    name: str
    user: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    is_active: bool = True


# In-memory storage (replace with database in production)
users_db: Dict[str, UserInDB] = {}
api_keys_db: Dict[str, APIKey] = {}


class PasswordHasher:
    """Password hashing utilities"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)


class TokenManager:
    """JWT token management"""
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token(data: dict) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Optional[TokenData]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            
            # Check token type
            if payload.get("type") != token_type:
                return None
            
            username: str = payload.get("sub")
            role: str = payload.get("role")
            exp: datetime = datetime.fromtimestamp(payload.get("exp"))
            
            if username is None:
                return None
            
            return TokenData(username=username, role=role, exp=exp)
            
        except JWTError as e:
            logger.error(f"Token verification failed: {str(e)}")
            return None


class AuthService:
    """Authentication service"""
    
    @staticmethod
    def get_user(username: str) -> Optional[UserInDB]:
        """Get user from database"""
        return users_db.get(username)
    
    @staticmethod
    def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
        """Authenticate user with username and password"""
        user = AuthService.get_user(username)
        if not user:
            return None
        if not PasswordHasher.verify_password(password, user.hashed_password):
            return None
        return user
    
    @staticmethod
    def create_user(user_data: UserCreate) -> UserInDB:
        """Create new user"""
        # Check if user already exists
        if user_data.username in users_db:
            raise ValueError("Username already exists")
        
        # Check if email already exists
        for user in users_db.values():
            if user.email == user_data.email:
                raise ValueError("Email already exists")
        
        # Create user
        hashed_password = PasswordHasher.hash_password(user_data.password)
        user = UserInDB(
            username=user_data.username,
            email=user_data.email,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            role="user",
            disabled=False
        )
        
        users_db[user.username] = user
        logger.info(f"User created: {user.username}")
        return user
    
    @staticmethod
    def create_tokens(user: UserInDB) -> Token:
        """Create access and refresh tokens for user"""
        access_token = TokenManager.create_access_token(
            data={"sub": user.username, "role": user.role}
        )
        refresh_token = TokenManager.create_refresh_token(
            data={"sub": user.username, "role": user.role}
        )
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )


class APIKeyService:
    """API Key management service"""
    
    @staticmethod
    def generate_api_key() -> str:
        """Generate a secure API key"""
        return f"kgpt_{secrets.token_urlsafe(32)}"
    
    @staticmethod
    def create_api_key(user: str, name: str, expires_days: Optional[int] = None) -> APIKey:
        """Create new API key for user"""
        key = APIKeyService.generate_api_key()
        
        expires_at = None
        if expires_days:
            expires_at = datetime.now() + timedelta(days=expires_days)
        
        api_key = APIKey(
            key=key,
            name=name,
            user=user,
            created_at=datetime.now(),
            expires_at=expires_at,
            is_active=True
        )
        
        api_keys_db[key] = api_key
        logger.info(f"API key created for user: {user}")
        return api_key
    
    @staticmethod
    def verify_api_key(key: str) -> Optional[APIKey]:
        """Verify API key"""
        api_key = api_keys_db.get(key)
        
        if not api_key:
            return None
        
        if not api_key.is_active:
            return None
        
        if api_key.expires_at and datetime.now() > api_key.expires_at:
            return None
        
        return api_key
    
    @staticmethod
    def revoke_api_key(key: str) -> bool:
        """Revoke API key"""
        api_key = api_keys_db.get(key)
        if api_key:
            api_key.is_active = False
            logger.info(f"API key revoked: {key[:10]}...")
            return True
        return False


# Dependency functions
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserInDB:
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    token_data = TokenManager.verify_token(token, token_type="access")
    
    if token_data is None or token_data.username is None:
        raise credentials_exception
    
    user = AuthService.get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    
    if user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    return user


async def get_current_active_user(
    current_user: UserInDB = Depends(get_current_user)
) -> UserInDB:
    """Get current active user"""
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_admin_user(
    current_user: UserInDB = Depends(get_current_user)
) -> UserInDB:
    """Get current user with admin role"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def verify_api_key_header(x_api_key: Optional[str] = Header(None)) -> Optional[str]:
    """Verify API key from header"""
    if not x_api_key:
        return None
    
    api_key = APIKeyService.verify_api_key(x_api_key)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key"
        )
    
    return api_key.user


def init_default_admin():
    """Initialize default admin user with secure random password"""
    if "admin" not in users_db:
        # Generate secure random password
        import secrets
        import string
        
        # Generate a 16-character secure password
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        default_password = ''.join(secrets.choice(alphabet) for _ in range(16))
        
        admin_user = UserInDB(
            username="admin",
            email="admin@kaligpt.local",
            full_name="Administrator",
            hashed_password=PasswordHasher.hash_password(default_password),
            role="admin",
            disabled=False,
            # Track that password needs to be changed
            metadata={"password_change_required": True}
        )
        users_db["admin"] = admin_user
        
        # Log the password securely - only show once at startup
        logger.critical("=" * 70)
        logger.critical("DEFAULT ADMIN USER CREATED - SECURE THIS IMMEDIATELY")
        logger.critical("=" * 70)
        logger.critical(f"Username: admin")
        logger.critical(f"Password: {default_password}")
        logger.critical("=" * 70)
        logger.critical("⚠️  ACTION REQUIRED: Change this password after first login!")
        logger.critical("⚠️  This password will NOT be shown again!")
        logger.critical("=" * 70)
        
        # Also print to console for visibility
        print("\n" + "=" * 70)
        print("DEFAULT ADMIN USER CREATED - SECURE THIS IMMEDIATELY")
        print("=" * 70)
        print(f"Username: admin")
        print(f"Password: {default_password}")
        print("=" * 70)
        print("⚠️  ACTION REQUIRED: Change this password after first login!")
        print("⚠️  This password will NOT be shown again!")
        print("=" * 70 + "\n")
