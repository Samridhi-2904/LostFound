import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.enums import UserRole
from app.models.history import AuditLog
from app.models.user import User
from app.schemas.auth import Token, UserRegister
from app.schemas.user import UserUpdate

settings = get_settings()


class AuthService:
    """Authentication and identity service managing registration, credentials, and profile changes."""

    @staticmethod
    def register_user(db: Session, user_in: UserRegister) -> User:
        """Register a new user with standard UserRole. Prevents role escalation."""
        normalized_email = user_in.email.lower().strip()
        existing_user = db.scalar(select(User).where(User.email == normalized_email))
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )

        new_user = User(
            full_name=user_in.full_name.strip(),
            email=normalized_email,
            phone=user_in.phone.strip() if user_in.phone else None,
            password_hash=hash_password(user_in.password),
            role=UserRole.USER,  # Strictly enforce regular user role on public registration
            is_active=True,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Audit log creation without sensitive credentials
        audit = AuditLog(
            actor_user_id=new_user.user_id,
            action="AUTH_REGISTER_SUCCESS",
            entity_type="User",
            entity_id=str(new_user.user_id),
            summary=json.dumps({"email": normalized_email, "role": new_user.role.value}),
        )
        db.add(audit)
        db.commit()

        return new_user

    @staticmethod
    def authenticate_user(
        db: Session,
        email: str,
        password: str,
        correlation_id: Optional[str] = None,
    ) -> User:
        """Authenticate user credentials and update last login timestamp."""
        normalized_email = email.lower().strip()
        user = db.scalar(select(User).where(User.email == normalized_email))

        if not user or not verify_password(password, user.password_hash):
            audit = AuditLog(
                actor_user_id=user.user_id if user else None,
                action="AUTH_LOGIN_FAILED",
                entity_type="User",
                entity_id=str(user.user_id) if user else None,
                summary=json.dumps({"email": normalized_email, "reason": "invalid_credentials"}),
                correlation_id=correlation_id,
            )
            db.add(audit)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            audit = AuditLog(
                actor_user_id=user.user_id,
                action="AUTH_LOGIN_INACTIVE",
                entity_type="User",
                entity_id=str(user.user_id),
                summary=json.dumps({"email": normalized_email, "reason": "inactive_account"}),
                correlation_id=correlation_id,
            )
            db.add(audit)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive. Please contact an administrator.",
            )

        # Successful login
        user.last_login_at = datetime.now(timezone.utc)
        audit = AuditLog(
            actor_user_id=user.user_id,
            action="AUTH_LOGIN_SUCCESS",
            entity_type="User",
            entity_id=str(user.user_id),
            summary=json.dumps({"email": normalized_email, "role": user.role.value}),
            correlation_id=correlation_id,
        )
        db.add(audit)
        db.commit()
        db.refresh(user)

        return user

    @staticmethod
    def create_token_for_user(user: User) -> Token:
        """Generate JWT access token for authenticated user."""
        access_token = create_access_token(
            subject=str(user.user_id),
            email=user.email,
            role=user.role.value,
        )
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    @staticmethod
    def update_profile(db: Session, current_user: User, user_update: UserUpdate) -> User:
        """Update current user's profile and optionally their password."""
        changes = []
        if user_update.full_name is not None and user_update.full_name.strip() != current_user.full_name:
            current_user.full_name = user_update.full_name.strip()
            changes.append("full_name")

        if user_update.phone is not None and user_update.phone.strip() != (current_user.phone or ""):
            current_user.phone = user_update.phone.strip() or None
            changes.append("phone")

        if user_update.new_password:
            if not user_update.current_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is required to set a new password.",
                )
            if not verify_password(user_update.current_password, current_user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password verification failed.",
                )
            current_user.password_hash = hash_password(user_update.new_password)
            changes.append("password")

        if changes:
            audit = AuditLog(
                actor_user_id=current_user.user_id,
                action="USER_PROFILE_UPDATED",
                entity_type="User",
                entity_id=str(current_user.user_id),
                summary=json.dumps({"updated_fields": changes}),
            )
            db.add(audit)
            db.commit()
            db.refresh(current_user)

        return current_user
