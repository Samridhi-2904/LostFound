from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_admin, require_staff
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.services.auth_service import AuthService

router = APIRouter(prefix="/users", tags=["Users"])


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update current user profile or password",
)
def update_current_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update profile attributes (name, phone) or change password."""
    updated_user = AuthService.update_profile(db, current_user, user_update)
    return updated_user


@router.get(
    "/role-check/staff",
    summary="Check staff access (Staff or Admin only)",
)
def check_staff_access(
    current_user: User = Depends(require_staff),
) -> Any:
    """Diagnostic/verification endpoint accessible to staff and admin only."""
    return {"message": f"Welcome staff member {current_user.full_name}", "role": current_user.role.value}


@router.get(
    "/role-check/admin",
    summary="Check administrator access (Admin only)",
)
def check_admin_access(
    current_user: User = Depends(require_admin),
) -> Any:
    """Diagnostic/verification endpoint accessible to admin only."""
    return {"message": f"Welcome administrator {current_user.full_name}", "role": current_user.role.value}
