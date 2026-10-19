from typing import Generator, Optional, Tuple
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_access_token, is_token_revoked
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import TokenPayload

settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=True,
)

oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)


def get_db() -> Generator[Session, None, None]:
    """Dependency providing an isolated database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_token_and_payload(
    token: str = Depends(oauth2_scheme),
) -> Tuple[str, TokenPayload]:
    """Validate JWT token, verify it is not revoked, and return token string and payload."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jti = payload.get("jti")
    if not jti or is_token_revoked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been terminated or token revoked. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token_payload = TokenPayload(
            sub=str(payload["sub"]),
            email=str(payload["email"]),
            role=str(payload["role"]),
            jti=str(jti),
            exp=int(payload["exp"]),
            iat=int(payload["iat"]),
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token structure.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token, token_payload


def get_current_user(
    db: Session = Depends(get_db),
    token_and_payload: Tuple[str, TokenPayload] = Depends(get_current_token_and_payload),
) -> User:
    """Dependency that resolves the authenticated user from the validated JWT token."""
    _, payload = token_and_payload
    try:
        user_id = int(payload.sub)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier in token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.scalar(select(User).where(User.user_id == user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account.",
        )

    return user


def require_staff(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency requiring the user to have Staff or Administrator role."""
    if current_user.role not in (UserRole.STAFF, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or administrator access required.",
        )
    return current_user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency requiring the user to have Administrator role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )
    return current_user


def get_optional_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme_optional),
) -> Optional[User]:
    """Dependency providing the authenticated user if token is present and valid; else None."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    jti = payload.get("jti")
    if not jti or is_token_revoked(jti):
        return None
    try:
        user_id = int(payload["sub"])
    except (ValueError, KeyError):
        return None
    user = db.scalar(select(User).where(User.user_id == user_id))
    if not user or not user.is_active:
        return None
    return user

