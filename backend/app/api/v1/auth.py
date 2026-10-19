from typing import Any, Tuple
from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_token_and_payload,
    get_current_user,
    get_db,
)
from app.core.security import revoke_token
from app.models.user import User
from app.schemas.auth import Token, TokenPayload, UserLogin, UserRegister
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(
    user_in: UserRegister,
    db: Session = Depends(get_db),
) -> Any:
    """Register a new user. Public registration always creates a standard user role."""
    new_user = AuthService.register_user(db, user_in)
    return new_user


@router.post(
    "/login",
    response_model=Token,
    summary="Sign in with email and password",
)
def login(
    credentials: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
    x_correlation_id: str = Header(default=None, alias="X-Correlation-ID"),
) -> Any:
    """Authenticate with registered email and password to receive a JWT access token."""
    user = AuthService.authenticate_user(
        db,
        email=credentials.email,
        password=credentials.password,
        correlation_id=x_correlation_id,
    )
    return AuthService.create_token_for_user(user)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Invalidate active authentication session",
)
def logout(
    token_and_payload: Tuple[str, TokenPayload] = Depends(get_current_token_and_payload),
) -> Any:
    """Invalidate current JWT access token so it cannot be reused."""
    _, payload = token_and_payload
    revoke_token(jti=payload.jti, exp_timestamp=payload.exp)
    return {"message": "Successfully logged out and session invalidated."}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
def read_current_user(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return the profile information of the currently authenticated user."""
    return current_user
