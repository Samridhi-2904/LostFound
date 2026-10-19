from typing import Any, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.user import User
from app.schemas.custody import (
    CustodyLocationAdminResponse,
    CustodyLocationCreate,
    CustodyLocationPublicResponse,
    CustodyLocationUpdate,
)
from app.services.custody_service import CustodyService

# Public/Staff active locations router
router = APIRouter(tags=["Custody Locations"])

# Admin custody locations router
admin_router = APIRouter(prefix="/admin/custody-locations", tags=["Admin Custody Locations"])


@router.get(
    "/custody-locations",
    response_model=List[CustodyLocationPublicResponse],
    summary="List active custody locations (Public-safe)",
)
def get_active_locations(
    db: Session = Depends(get_db),
) -> Any:
    """Public listing of custody locations without restricted room/locker details."""
    return CustodyService.list_active(db)


@admin_router.get(
    "",
    response_model=List[CustodyLocationAdminResponse],
    summary="List all custody locations with restricted details (Admin only)",
)
def admin_get_all_locations(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> Any:
    """Administrator listing of all custody locations including private address details."""
    return CustodyService.list_all(db)


@admin_router.post(
    "",
    response_model=CustodyLocationAdminResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new custody location (Admin only)",
)
def admin_create_location(
    location_in: CustodyLocationCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> Any:
    """Administrator creation of a custody location."""
    return CustodyService.create(db, location_in, admin_id=current_admin.user_id)


@admin_router.patch(
    "/{location_id}",
    response_model=CustodyLocationAdminResponse,
    summary="Update a custody location (Admin only)",
)
def admin_update_location(
    location_id: int,
    location_in: CustodyLocationUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> Any:
    """Administrator update of custody location details or activation status."""
    return CustodyService.update(db, location_id, location_in, admin_id=current_admin.user_id)
