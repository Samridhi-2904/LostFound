import json
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.history import AuditLog
from app.schemas.category import CategoryCreate, CategoryUpdate


class CategoryService:
    """Service handling category listing, creation, and administrative updates."""

    @staticmethod
    def list_active(db: Session) -> List[Category]:
        """Return list of active categories for public view."""
        return list(db.scalars(select(Category).where(Category.is_active == True).order_by(Category.category_name)).all())

    @staticmethod
    def list_all(db: Session) -> List[Category]:
        """Return list of all categories including deactivated ones for administrators."""
        return list(db.scalars(select(Category).order_by(Category.category_name)).all())

    @staticmethod
    def get_by_id(db: Session, category_id: int) -> Category:
        """Fetch category by ID or raise 404."""
        cat = db.scalar(select(Category).where(Category.category_id == category_id))
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category with ID {category_id} not found.",
            )
        return cat

    @staticmethod
    def create(db: Session, category_in: CategoryCreate, admin_id: int) -> Category:
        """Create a new category. Prevents duplicate category names."""
        name = category_in.category_name.strip()
        existing = db.scalar(select(Category).where(Category.category_name.ilike(name)))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category with name '{name}' already exists.",
            )

        cat = Category(
            category_name=name,
            description=category_in.description.strip() if category_in.description else None,
            is_active=True,
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)

        audit = AuditLog(
            actor_user_id=admin_id,
            action="CATEGORY_CREATED",
            entity_type="Category",
            entity_id=str(cat.category_id),
            summary=json.dumps({"name": cat.category_name}),
        )
        db.add(audit)
        db.commit()

        return cat

    @staticmethod
    def update(db: Session, category_id: int, category_in: CategoryUpdate, admin_id: int) -> Category:
        """Update category details or activation status."""
        cat = CategoryService.get_by_id(db, category_id)

        changes = []
        if category_in.category_name is not None and category_in.category_name.strip() != cat.category_name:
            new_name = category_in.category_name.strip()
            existing = db.scalar(
                select(Category).where(Category.category_name.ilike(new_name), Category.category_id != category_id)
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Category with name '{new_name}' already exists.",
                )
            cat.category_name = new_name
            changes.append("category_name")

        if category_in.description is not None:
            cat.description = category_in.description.strip() or None
            changes.append("description")

        if category_in.is_active is not None and category_in.is_active != cat.is_active:
            cat.is_active = category_in.is_active
            changes.append("is_active")

        if changes:
            audit = AuditLog(
                actor_user_id=admin_id,
                action="CATEGORY_UPDATED",
                entity_type="Category",
                entity_id=str(cat.category_id),
                summary=json.dumps({"updated_fields": changes}),
            )
            db.add(audit)
            db.commit()
            db.refresh(cat)

        return cat
