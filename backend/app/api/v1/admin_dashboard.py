from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.admin import (
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
    DashboardStatsResponse,
)
from app.schemas.user import UserResponse
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["Administrator Dashboard & User Management"])


@router.get(
    "/dashboard/stats",
    response_model=DashboardStatsResponse,
    summary="Get system operational metrics and report status counts (Admin only)",
)
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Any:
    """Retrieve operational dashboard counts and metrics across lifecycle and moderation states (FR-23)."""
    return AdminService.get_dashboard_stats(db)


@router.get(
    "/users",
    response_model=List[UserResponse],
    summary="List registered users (Admin only)",
)
def list_users(
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Any:
    """Administrator user directory and role management view."""
    return AdminService.list_users(
        db,
        role=role,
        is_active=is_active,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.patch(
    "/users/{user_id}/role",
    response_model=UserResponse,
    summary="Update user role or staff profile (Admin only)",
)
def update_user_role(
    user_id: int,
    role_in: AdminUserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Any:
    """Assign user role (user, staff, admin) and staff department. Prevents self-demotion."""
    return AdminService.update_user_role(db, user_id, role_in, current_user)


@router.patch(
    "/users/{user_id}/status",
    response_model=UserResponse,
    summary="Activate or suspend a user account (Admin only)",
)
def update_user_status(
    user_id: int,
    status_in: AdminUserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Any:
    """Activate or deactivate a user account with recorded reason. Prevents self-deactivation."""
    return AdminService.update_user_status(db, user_id, status_in, current_user)
