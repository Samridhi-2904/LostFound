import json
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.custody import CustodyLocation
from app.models.history import AuditLog
from app.schemas.custody import CustodyLocationCreate, CustodyLocationUpdate


class CustodyService:
    """Service handling secure custody location management."""

    @staticmethod
    def list_active(db: Session) -> List[CustodyLocation]:
        """List active custody locations."""
        return list(
            db.scalars(
                select(CustodyLocation)
                .where(CustodyLocation.is_active == True)
                .order_by(CustodyLocation.name)
            ).all()
        )

    @staticmethod
    def list_all(db: Session) -> List[CustodyLocation]:
        """List all custody locations for administrators."""
        return list(db.scalars(select(CustodyLocation).order_by(CustodyLocation.name)).all())

    @staticmethod
    def get_by_id(db: Session, location_id: int) -> CustodyLocation:
        """Fetch custody location by ID or raise 404."""
        loc = db.scalar(
            select(CustodyLocation).where(CustodyLocation.custody_location_id == location_id)
        )
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Custody location with ID {location_id} not found.",
            )
        return loc

    @staticmethod
    def create(db: Session, location_in: CustodyLocationCreate, admin_id: int) -> CustodyLocation:
        """Create a new custody location with private restricted details."""
        name = location_in.name.strip()
        existing = db.scalar(select(CustodyLocation).where(CustodyLocation.name.ilike(name)))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Custody location with name '{name}' already exists.",
            )

        loc = CustodyLocation(
            name=name,
            description=location_in.description.strip() if location_in.description else None,
            restricted_details=location_in.restricted_details.strip(),
            is_active=True,
        )
        db.add(loc)
        db.commit()
        db.refresh(loc)

        audit = AuditLog(
            actor_user_id=admin_id,
            action="CUSTODY_LOCATION_CREATED",
            entity_type="CustodyLocation",
            entity_id=str(loc.custody_location_id),
            summary=json.dumps({"name": loc.name}),
        )
        db.add(audit)
        db.commit()

        return loc

    @staticmethod
    def update(
        db: Session,
        location_id: int,
        location_in: CustodyLocationUpdate,
        admin_id: int,
    ) -> CustodyLocation:
        """Update custody location details, address, or active state."""
        loc = CustodyService.get_by_id(db, location_id)

        changes = []
        if location_in.name is not None and location_in.name.strip() != loc.name:
            new_name = location_in.name.strip()
            existing = db.scalar(
                select(CustodyLocation).where(
                    CustodyLocation.name.ilike(new_name),
                    CustodyLocation.custody_location_id != location_id,
                )
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Custody location with name '{new_name}' already exists.",
                )
            loc.name = new_name
            changes.append("name")

        if location_in.description is not None:
            loc.description = location_in.description.strip() or None
            changes.append("description")

        if location_in.restricted_details is not None and location_in.restricted_details.strip() != loc.restricted_details:
            loc.restricted_details = location_in.restricted_details.strip()
            changes.append("restricted_details")

        if location_in.is_active is not None and location_in.is_active != loc.is_active:
            loc.is_active = location_in.is_active
            changes.append("is_active")

        if changes:
            audit = AuditLog(
                actor_user_id=admin_id,
                action="CUSTODY_LOCATION_UPDATED",
                entity_type="CustodyLocation",
                entity_id=str(loc.custody_location_id),
                summary=json.dumps({"updated_fields": changes}),
            )
            db.add(audit)
            db.commit()
            db.refresh(loc)

        return loc
