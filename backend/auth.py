"""
Authentication and authorization for KaliGPT.
JWT auth with persistent users (SQLite/Postgres) and RBAC roles.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Callable, Optional, Set
import jwt
from jwt.exceptions import InvalidTokenError as JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session
import os
import secrets
import logging
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before reading secrets (import order safe for local runs)
load_dotenv(Path(__file__).resolve().parent / ".env")

from db.session import SessionLocal, get_db
from db.models.user import APIKeyRecord, UserRecord, VALID_ROLES

logger = logging.getLogger(__name__)

_raw_secret = os.getenv("SECRET_KEY", "").strip()
if _raw_secret:
    SECRET_KEY = _raw_secret
else:
    SECRET_KEY = secrets.token_urlsafe(32)
    logger.warning(
        "SECRET_KEY is not set; using an ephemeral key. "
        "Tokens will invalidate on restart. Set SECRET_KEY in the environment."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# bcrypt only consumes the first 72 bytes of a secret. Longer inputs are
# truncated (bcrypt <5) or rejected (bcrypt >=5); keep app limits in sync.
BCRYPT_MAX_PASSWORD_BYTES = 72


def _password_utf8_byte_length(password: str) -> int:
    return len(password.encode("utf-8"))


def _ensure_bcrypt_password_length(password: str, *, label: str = "Password") -> str:
    """Reject secrets that exceed bcrypt's 72-byte input limit."""
    byte_len = _password_utf8_byte_length(password)
    if byte_len > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(
            f"{label} cannot exceed {BCRYPT_MAX_PASSWORD_BYTES} bytes "
            f"(got {byte_len}; bcrypt limit)"
        )
    return password


class User(BaseModel):
    id: Optional[int] = None
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = None
    disabled: bool = False
    role: str = "operator"
    auth_provider: str = "local"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username must be alphanumeric (with _ or - allowed)")
        return v

    @field_validator("role")
    @classmethod
    def role_allowed(cls, v: str) -> str:
        # Accept legacy "user" as operator
        if v == "user":
            return "operator"
        if v not in VALID_ROLES:
            raise ValueError(f"Role must be one of: {', '.join(VALID_ROLES)}")
        return v


class UserInDB(User):
    hashed_password: Optional[str] = None


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    # bcrypt accepts at most 72 bytes; keep Field max in sync
    password: str = Field(..., min_length=8, max_length=BCRYPT_MAX_PASSWORD_BYTES)
    full_name: Optional[str] = None
    role: str = "operator"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        _ensure_bcrypt_password_length(v)
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("role")
    @classmethod
    def role_allowed(cls, v: str) -> str:
        if v == "user":
            return "operator"
        if v not in VALID_ROLES:
            raise ValueError(f"Role must be one of: {', '.join(VALID_ROLES)}")
        return v


class UserLogin(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=1, max_length=BCRYPT_MAX_PASSWORD_BYTES)

    @field_validator("password")
    @classmethod
    def password_bcrypt_limit(cls, v: str) -> str:
        return _ensure_bcrypt_password_length(v)


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    uid: Optional[int] = None
    exp: Optional[datetime] = None


class APIKey(BaseModel):
    key: str
    name: str
    user: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    is_active: bool = True


class PasswordHasher:
    @staticmethod
    def hash_password(password: str) -> str:
        _ensure_bcrypt_password_length(password)
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        # Refuse oversize inputs so bcrypt>=5 does not raise during login.
        if _password_utf8_byte_length(plain_password) > BCRYPT_MAX_PASSWORD_BYTES:
            return False
        return pwd_context.verify(plain_password, hashed_password)


class TokenManager:
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + (
            expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        to_encode.update({"exp": expire, "type": "access"})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    @staticmethod
    def create_refresh_token(data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire, "type": "refresh"})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Optional[TokenData]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("type") != token_type:
                return None
            username = payload.get("sub")
            if username is None:
                return None
            return TokenData(
                username=username,
                role=payload.get("role"),
                uid=payload.get("uid"),
                exp=datetime.fromtimestamp(payload.get("exp")),
            )
        except JWTError as e:
            logger.warning("Token verification failed (%s)", type(e).__name__)
            return None


def _record_to_user(record: UserRecord) -> UserInDB:
    role = record.role if record.role != "user" else "operator"
    return UserInDB(
        id=record.id,
        username=record.username,
        email=record.email,
        full_name=record.full_name,
        hashed_password=record.hashed_password,
        role=role,
        disabled=record.disabled,
        auth_provider=record.auth_provider,
        created_at=record.created_at or datetime.utcnow(),
    )


class AuthService:
    @staticmethod
    def get_user(username: str, db: Optional[Session] = None) -> Optional[UserInDB]:
        owns_session = db is None
        session = db or SessionLocal()
        try:
            record = (
                session.query(UserRecord)
                .filter(UserRecord.username == username)
                .one_or_none()
            )
            return _record_to_user(record) if record else None
        finally:
            if owns_session:
                session.close()

    @staticmethod
    def authenticate_user(username: str, password: str, db: Optional[Session] = None) -> Optional[UserInDB]:
        user = AuthService.get_user(username, db=db)
        if not user or not user.hashed_password:
            return None
        if not PasswordHasher.verify_password(password, user.hashed_password):
            return None
        return user

    @staticmethod
    def create_user(user_data: UserCreate, db: Optional[Session] = None) -> UserInDB:
        owns_session = db is None
        session = db or SessionLocal()
        try:
            if session.query(UserRecord).filter(UserRecord.username == user_data.username).first():
                raise ValueError("Username already exists")
            if session.query(UserRecord).filter(UserRecord.email == user_data.email).first():
                raise ValueError("Email already exists")

            record = UserRecord(
                username=user_data.username,
                email=user_data.email,
                full_name=user_data.full_name,
                hashed_password=PasswordHasher.hash_password(user_data.password),
                role=user_data.role if user_data.role != "user" else "operator",
                disabled=False,
                auth_provider="local",
                created_at=datetime.utcnow(),
            )
            session.add(record)
            session.commit()
            session.refresh(record)
            logger.info("User created: %s (role=%s)", record.username, record.role)
            return _record_to_user(record)
        finally:
            if owns_session:
                session.close()

    @staticmethod
    def create_tokens(user: UserInDB) -> Token:
        claims = {"sub": user.username, "role": user.role, "uid": user.id}
        return Token(
            access_token=TokenManager.create_access_token(data=claims),
            refresh_token=TokenManager.create_refresh_token(data=claims),
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )


class APIKeyService:
    @staticmethod
    def generate_api_key() -> str:
        return f"kgpt_{secrets.token_urlsafe(32)}"

    @staticmethod
    def create_api_key(
        user: str, name: str, expires_days: Optional[int] = None, db: Optional[Session] = None
    ) -> APIKey:
        owns_session = db is None
        session = db or SessionLocal()
        try:
            key = APIKeyService.generate_api_key()
            expires_at = (
                datetime.utcnow() + timedelta(days=expires_days) if expires_days else None
            )
            record = APIKeyRecord(
                key=key,
                name=name,
                username=user,
                created_at=datetime.utcnow(),
                expires_at=expires_at,
                is_active=True,
            )
            session.add(record)
            session.commit()
            logger.info("API key created for user: %s", user)
            return APIKey(
                key=key,
                name=name,
                user=user,
                created_at=record.created_at,
                expires_at=expires_at,
                is_active=True,
            )
        finally:
            if owns_session:
                session.close()

    @staticmethod
    def verify_api_key(key: str, db: Optional[Session] = None) -> Optional[APIKey]:
        owns_session = db is None
        session = db or SessionLocal()
        try:
            record = session.query(APIKeyRecord).filter(APIKeyRecord.key == key).one_or_none()
            if not record or not record.is_active:
                return None
            if record.expires_at and datetime.utcnow() > record.expires_at:
                return None
            return APIKey(
                key=record.key,
                name=record.name,
                user=record.username,
                created_at=record.created_at,
                expires_at=record.expires_at,
                is_active=record.is_active,
            )
        finally:
            if owns_session:
                session.close()

    @staticmethod
    def revoke_api_key(key: str, db: Optional[Session] = None) -> bool:
        owns_session = db is None
        session = db or SessionLocal()
        try:
            record = session.query(APIKeyRecord).filter(APIKeyRecord.key == key).one_or_none()
            if not record:
                return False
            record.is_active = False
            session.commit()
            return True
        finally:
            if owns_session:
                session.close()


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise credentials_exception

    token_data = TokenManager.verify_token(credentials.credentials, token_type="access")
    if token_data is None or token_data.username is None:
        raise credentials_exception

    user = AuthService.get_user(username=token_data.username, db=db)
    if user is None:
        raise credentials_exception
    if user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


async def get_current_active_user(
    current_user: UserInDB = Depends(get_current_user),
) -> UserInDB:
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_roles(*roles: str) -> Callable:
    """Dependency factory: allow any of the listed roles."""
    allowed: Set[str] = set(roles)

    async def _dependency(
        current_user: UserInDB = Depends(get_current_active_user),
    ) -> UserInDB:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user

    return _dependency


async def get_current_admin_user(
    current_user: UserInDB = Depends(require_roles("admin")),
) -> UserInDB:
    return current_user


async def verify_api_key_header(
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[str]:
    if not x_api_key:
        return None
    api_key = APIKeyService.verify_api_key(x_api_key, db=db)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key",
        )
    return api_key.user


def init_default_admin(db: Optional[Session] = None) -> None:
    """Seed default admin from env if no admin exists."""
    owns_session = db is None
    session = db or SessionLocal()
    try:
        existing_admin = (
            session.query(UserRecord).filter(UserRecord.role == "admin").first()
        )
        if existing_admin:
            return

        admin_username = os.getenv("KALIGPT_ADMIN_USERNAME", "admin").strip() or "admin"
        admin_email = os.getenv("KALIGPT_ADMIN_EMAIL", "admin@example.com").strip()
        admin_password = os.getenv("KALIGPT_ADMIN_PASSWORD", "")
        if not admin_password:
            logger.warning(
                "Default admin was not initialized; set KALIGPT_ADMIN_PASSWORD "
                "in the backend environment to enable login."
            )
            return
        if len(admin_password) < 16:
            raise ValueError("KALIGPT_ADMIN_PASSWORD must be at least 16 characters")
        _ensure_bcrypt_password_length(
            admin_password, label="KALIGPT_ADMIN_PASSWORD"
        )

        record = UserRecord(
            username=admin_username,
            email=admin_email,
            full_name="Administrator",
            hashed_password=PasswordHasher.hash_password(admin_password),
            role="admin",
            disabled=False,
            auth_provider="local",
            created_at=datetime.utcnow(),
        )
        session.add(record)
        session.commit()
        logger.info("Default admin user initialized; password material was not logged.")
    finally:
        if owns_session:
            session.close()
