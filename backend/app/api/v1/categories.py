from typing import Any, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services.category_service import CategoryService

# Public categories router
router = APIRouter(tags=["Categories"])

# Admin categories router
admin_router = APIRouter(prefix="/admin/categories", tags=["Admin Categories"])


@router.get(
    "/categories",
    response_model=List[CategoryResponse],
    summary="List active categories",
)
def get_active_categories(
    db: Session = Depends(get_db),
) -> Any:
    """Public listing of all currently active categories."""
    return CategoryService.list_active(db)


@admin_router.get(
    "",
    response_model=List[CategoryResponse],
    summary="List all categories (Admin only)",
)
def admin_get_all_categories(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> Any:
    """Administrator listing of all categories including inactive ones."""
    return CategoryService.list_all(db)


@admin_router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new category (Admin only)",
)
def admin_create_category(
    category_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> Any:
    """Administrator creation of a new category."""
    return CategoryService.create(db, category_in, admin_id=current_admin.user_id)


@admin_router.patch(
    "/{category_id}",
    response_model=CategoryResponse,
    summary="Update or deactivate a category (Admin only)",
)
def admin_update_category(
    category_id: int,
    category_in: CategoryUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> Any:
    """Administrator update or soft deactivation of a category."""
    return CategoryService.update(db, category_id, category_in, admin_id=current_admin.user_id)
