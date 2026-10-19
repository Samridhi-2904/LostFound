from datetime import datetime, timezone, timedelta
import uuid
from typing import Any, Dict, Optional, Set
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

from app.core.config import get_settings

settings = get_settings()

# Initialize Argon2id password hasher with secure defaults
_hasher = PasswordHasher()

# In-memory revocation set storing revoked token JTIs (with expiration timestamps)
_revoked_tokens: Dict[str, datetime] = {}


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError):
        return False


def create_access_token(
    subject: str,
    email: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token containing subject ID, email, role, and unique JTI."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = str(uuid.uuid4())
    payload: Dict[str, Any] = {
        "sub": str(subject),
        "email": email,
        "role": role,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    encoded_jwt = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            options={"require": ["exp", "sub", "jti"]},
        )
        return payload
    except (jwt.PyJWTError, Exception):
        return None


def revoke_token(jti: str, exp_timestamp: Optional[int] = None) -> None:
    """Add a token JTI to the revocation blacklist."""
    now = datetime.now(timezone.utc)
    if exp_timestamp:
        exp_dt = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
    else:
        exp_dt = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    _revoked_tokens[jti] = exp_dt
    _clean_expired_revocations()


def is_token_revoked(jti: str) -> bool:
    """Check if a token JTI is in the revocation blacklist."""
    _clean_expired_revocations()
    return jti in _revoked_tokens


def _clean_expired_revocations() -> None:
    """Purge expired tokens from the blacklist to prevent unbounded memory growth."""
    now = datetime.now(timezone.utc)
    expired_keys = [jti for jti, exp_dt in _revoked_tokens.items() if exp_dt < now]
    for key in expired_keys:
        _revoked_tokens.pop(key, None)
