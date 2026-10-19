from datetime import datetime, timezone
import json
import uuid
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.category import Category
from app.models.claim import Claim
from app.models.custody import CustodyLocation
from app.models.enums import (
    ClaimStatus,
    LifecycleStatus,
    ModerationStatus,
    ReportType,
    UserRole,
)
from app.models.history import AuditLog, ReportStatusHistory
from app.models.report import FoundItem, ItemReport, LostItem
from app.models.user import User
from app.schemas.report import ReportCreate, ReportStatusTransition, ReportUpdate


class ReportService:
    """Service managing item report creation, lifecycle changes, moderation, and privacy rules."""

    @staticmethod
    def generate_case_reference(db: Session, report_type: ReportType) -> str:
        """Generate a unique human-readable case reference ID, e.g. LF-2026-A1B2C3."""
        year = datetime.now(timezone.utc).year
        prefix = "LR" if report_type == ReportType.LOST else "FR"
        for _ in range(10):
            token = uuid.uuid4().hex[:6].upper()
            case_ref = f"{prefix}-{year}-{token}"
            existing = db.scalar(select(ItemReport).where(ItemReport.case_reference == case_ref))
            if not existing:
                return case_ref
        # Fallback with longer token
        return f"{prefix}-{year}-{uuid.uuid4().hex[:8].upper()}"

    @staticmethod
    def create_report(db: Session, report_in: ReportCreate, user: User) -> ItemReport:
        """Create a new report, initialize status history, and generate case reference."""
        # 1. Validate Category
        category = db.scalar(select(Category).where(Category.category_id == report_in.category_id))
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category with ID {report_in.category_id} not found.",
            )
        if not category.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category '{category.category_name}' is inactive and cannot accept new reports.",
            )

        # 2. Validate Custody Location if supplied for found report
        if report_in.report_type == ReportType.FOUND and report_in.custody_location_id:
            custody = db.scalar(
                select(CustodyLocation).where(
                    CustodyLocation.custody_location_id == report_in.custody_location_id
                )
            )
            if not custody:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Custody location with ID {report_in.custody_location_id} not found.",
                )
            if not custody.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Custody location '{custody.name}' is inactive.",
                )

        case_ref = ReportService.generate_case_reference(db, report_in.report_type)

        report = ItemReport(
            case_reference=case_ref,
            created_by=user.user_id,
            category_id=report_in.category_id,
            report_type=report_in.report_type,
            item_name=report_in.item_name.strip(),
            description=report_in.description.strip(),
            date_reported=datetime.now(timezone.utc),
            date_lost_found=report_in.date_lost_found,
            location=report_in.location.strip(),
            colour=report_in.colour.strip() if report_in.colour else None,
            brand=report_in.brand.strip() if report_in.brand else None,
            distinguishing_marks=report_in.distinguishing_marks.strip() if report_in.distinguishing_marks else None,
            contact_preference=report_in.contact_preference.strip(),
            contact_info_restricted=report_in.contact_info_restricted.strip() if report_in.contact_info_restricted else None,
            moderation_status=ModerationStatus.PENDING_REVIEW,
            lifecycle_status=LifecycleStatus.OPEN,
            visibility="public",
        )
        db.add(report)
        db.flush()  # Allocate report_id

        # 3. Create Subtype
        if report_in.report_type == ReportType.LOST:
            lost_sub = LostItem(
                report_id=report.report_id,
                last_seen_location=report_in.last_seen_location.strip() if report_in.last_seen_location else None,
                reward_offered=report_in.reward_offered.strip() if report_in.reward_offered else None,
            )
            db.add(lost_sub)
        else:
            found_sub = FoundItem(
                report_id=report.report_id,
                found_location=(report_in.found_location or report_in.location).strip(),
                custody_location_id=report_in.custody_location_id,
                storage_reference=report_in.storage_reference.strip() if report_in.storage_reference else None,
            )
            db.add(found_sub)

        # 4. Status History Record
        history = ReportStatusHistory(
            report_id=report.report_id,
            previous_lifecycle_status=None,
            new_lifecycle_status=LifecycleStatus.OPEN.value,
            previous_moderation_status=None,
            new_moderation_status=ModerationStatus.PENDING_REVIEW.value,
            new_custody_location_id=report_in.custody_location_id if report_in.report_type == ReportType.FOUND else None,
            changed_by=user.user_id,
            reason="Report submitted by user.",
        )
        db.add(history)

        # 5. Audit Log
        audit = AuditLog(
            actor_user_id=user.user_id,
            action="REPORT_CREATED",
            entity_type="ItemReport",
            entity_id=str(report.report_id),
            summary=json.dumps({"case_reference": case_ref, "type": report_in.report_type.value}),
        )
        db.add(audit)

        db.commit()
        db.refresh(report)

        # Trigger deterministic matching engine
        from app.services.matching_service import MatchingService
        MatchingService.run_matching_for_report(db, report)

        return report

    @staticmethod
    def get_by_id(db: Session, report_id: int) -> ItemReport:
        """Fetch report with attached subtypes, category, creator, and history."""
        report = db.scalar(
            select(ItemReport)
            .options(
                joinedload(ItemReport.category),
                joinedload(ItemReport.creator),
                joinedload(ItemReport.lost_item),
                joinedload(ItemReport.found_item).joinedload(FoundItem.custody_location),
                selectinload(ItemReport.status_history),
            )
            .where(ItemReport.report_id == report_id)
        )
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item report with ID {report_id} not found.",
            )
        return report

    @staticmethod
    def update_report(
        db: Session,
        report_id: int,
        report_in: ReportUpdate,
        user: User,
    ) -> ItemReport:
        """Update report fields. Enforces ownership and allowed status invariants."""
        report = ReportService.get_by_id(db, report_id)

        # Ownership check
        is_owner = report.created_by == user.user_id
        is_staff_or_admin = user.role in (UserRole.STAFF, UserRole.ADMIN)
        if not (is_owner or is_staff_or_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify this report.",
            )

        # State check: closed or resolved reports cannot be freely edited
        if report.lifecycle_status in (
            LifecycleStatus.RETURNED,
            LifecycleStatus.ARCHIVED,
            LifecycleStatus.DISPOSED,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Report cannot be edited in its current lifecycle status: '{report.lifecycle_status.value}'.",
            )

        changes = []
        if report_in.item_name is not None and report_in.item_name.strip() != report.item_name:
            report.item_name = report_in.item_name.strip()
            changes.append("item_name")

        if report_in.description is not None and report_in.description.strip() != report.description:
            report.description = report_in.description.strip()
            changes.append("description")

        if report_in.date_lost_found is not None:
            report.date_lost_found = report_in.date_lost_found
            changes.append("date_lost_found")

        if report_in.location is not None and report_in.location.strip() != report.location:
            report.location = report_in.location.strip()
            changes.append("location")

        if report_in.colour is not None:
            report.colour = report_in.colour.strip() or None
            changes.append("colour")

        if report_in.brand is not None:
            report.brand = report_in.brand.strip() or None
            changes.append("brand")

        if report_in.distinguishing_marks is not None:
            report.distinguishing_marks = report_in.distinguishing_marks.strip() or None
            changes.append("distinguishing_marks")

        if report_in.contact_preference is not None:
            report.contact_preference = report_in.contact_preference.strip()
            changes.append("contact_preference")

        if report_in.contact_info_restricted is not None:
            report.contact_info_restricted = report_in.contact_info_restricted.strip() or None
            changes.append("contact_info_restricted")

        # Subtype updates
        if report.report_type == ReportType.LOST and report.lost_item:
            if report_in.last_seen_location is not None:
                report.lost_item.last_seen_location = report_in.last_seen_location.strip() or None
                changes.append("last_seen_location")
            if report_in.reward_offered is not None:
                report.lost_item.reward_offered = report_in.reward_offered.strip() or None
                changes.append("reward_offered")

        elif report.report_type == ReportType.FOUND and report.found_item:
            if report_in.found_location is not None:
                report.found_item.found_location = report_in.found_location.strip()
                changes.append("found_location")
            if report_in.storage_reference is not None:
                report.found_item.storage_reference = report_in.storage_reference.strip() or None
                changes.append("storage_reference")
            if report_in.custody_location_id is not None:
                if report_in.custody_location_id != report.found_item.custody_location_id:
                    custody = db.scalar(
                        select(CustodyLocation).where(
                            CustodyLocation.custody_location_id == report_in.custody_location_id
                        )
                    )
                    if not custody or not custody.is_active:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Selected custody location is invalid or inactive.",
                        )
                    old_custody = report.found_item.custody_location_id
                    report.found_item.custody_location_id = report_in.custody_location_id
                    changes.append("custody_location_id")
                    # Track custody transition in status history
                    history = ReportStatusHistory(
                        report_id=report.report_id,
                        previous_custody_location_id=old_custody,
                        new_custody_location_id=report_in.custody_location_id,
                        changed_by=user.user_id,
                        reason="Custody location reassigned by user/staff.",
                    )
                    db.add(history)

        if changes:
            audit = AuditLog(
                actor_user_id=user.user_id,
                action="REPORT_UPDATED",
                entity_type="ItemReport",
                entity_id=str(report.report_id),
                summary=json.dumps({"updated_fields": changes}),
            )
            db.add(audit)
            db.commit()
            db.refresh(report)

            # Re-evaluate matching on report update
            from app.services.matching_service import MatchingService
            MatchingService.run_matching_for_report(db, report)

        return report

    @staticmethod
    def close_report(
        db: Session,
        report_id: int,
        user: User,
        reason: Optional[str] = None,
    ) -> ItemReport:
        """Allow report creator or staff/admin to close an open report."""
        report = ReportService.get_by_id(db, report_id)

        is_owner = report.created_by == user.user_id
        is_staff_or_admin = user.role in (UserRole.STAFF, UserRole.ADMIN)
        if not (is_owner or is_staff_or_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to close this report.",
            )

        if report.lifecycle_status in (
            LifecycleStatus.ARCHIVED,
            LifecycleStatus.RETURNED,
            LifecycleStatus.DISPOSED,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Report is already in '{report.lifecycle_status.value}' status.",
            )

        old_status = report.lifecycle_status.value
        report.lifecycle_status = LifecycleStatus.ARCHIVED

        history = ReportStatusHistory(
            report_id=report.report_id,
            previous_lifecycle_status=old_status,
            new_lifecycle_status=LifecycleStatus.ARCHIVED.value,
            changed_by=user.user_id,
            reason=reason or "Report closed/archived by creator or staff.",
        )
        db.add(history)

        audit = AuditLog(
            actor_user_id=user.user_id,
            action="REPORT_CLOSED",
            entity_type="ItemReport",
            entity_id=str(report.report_id),
            summary=json.dumps({"from": old_status, "to": LifecycleStatus.ARCHIVED.value, "reason": reason}),
        )
        db.add(audit)

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def moderate_report(
        db: Session,
        report_id: int,
        new_status: ModerationStatus,
        staff_user: User,
        reason: str,
    ) -> ItemReport:
        """Moderate a report: verify or reject."""
        report = ReportService.get_by_id(db, report_id)

        old_mod_status = report.moderation_status.value
        report.moderation_status = new_status
        report.verified_by = staff_user.user_id
        report.verified_at = datetime.now(timezone.utc)

        history = ReportStatusHistory(
            report_id=report.report_id,
            previous_moderation_status=old_mod_status,
            new_moderation_status=new_status.value,
            changed_by=staff_user.user_id,
            reason=reason,
        )
        db.add(history)

        audit = AuditLog(
            actor_user_id=staff_user.user_id,
            action=f"REPORT_MODERATION_{new_status.name}",
            entity_type="ItemReport",
            entity_id=str(report.report_id),
            summary=json.dumps({"from": old_mod_status, "to": new_status.value, "reason": reason}),
        )
        db.add(audit)

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def transition_status(
        db: Session,
        report_id: int,
        transition: ReportStatusTransition,
        staff_user: User,
    ) -> ItemReport:
        """Transition report lifecycle or custody within policy bounds."""
        report = ReportService.get_by_id(db, report_id)

        # Invariant: 'returned' cannot be directly assigned here without verified Return handover
        if transition.lifecycle_status == LifecycleStatus.RETURNED:
            # Check if there is an approved claim and recorded handover
            has_return = any(
                c.status == ClaimStatus.APPROVED and c.return_record is not None for c in report.claims
            )
            if not has_return:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Report cannot transition to 'returned' without an approved claim and recorded handover confirmation.",
                )

        old_lifecycle = report.lifecycle_status.value
        old_moderation = report.moderation_status.value
        old_custody = report.found_item.custody_location_id if report.found_item else None

        if transition.lifecycle_status is not None:
            report.lifecycle_status = transition.lifecycle_status

        if transition.moderation_status is not None:
            report.moderation_status = transition.moderation_status
            report.verified_by = staff_user.user_id
            report.verified_at = datetime.now(timezone.utc)

        new_custody = None
        if transition.custody_location_id is not None and report.found_item:
            custody = db.scalar(
                select(CustodyLocation).where(
                    CustodyLocation.custody_location_id == transition.custody_location_id
                )
            )
            if not custody or not custody.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specified custody location is invalid or inactive.",
                )
            report.found_item.custody_location_id = transition.custody_location_id
            new_custody = transition.custody_location_id

        history = ReportStatusHistory(
            report_id=report.report_id,
            previous_lifecycle_status=old_lifecycle,
            new_lifecycle_status=report.lifecycle_status.value,
            previous_moderation_status=old_moderation,
            new_moderation_status=report.moderation_status.value,
            previous_custody_location_id=old_custody,
            new_custody_location_id=new_custody or old_custody,
            changed_by=staff_user.user_id,
            reason=transition.reason,
        )
        db.add(history)

        audit = AuditLog(
            actor_user_id=staff_user.user_id,
            action="REPORT_STATUS_TRANSITION",
            entity_type="ItemReport",
            entity_id=str(report.report_id),
            summary=json.dumps({
                "lifecycle": report.lifecycle_status.value,
                "moderation": report.moderation_status.value,
                "reason": transition.reason,
            }),
        )
        db.add(audit)

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def format_report_dict(
        report: ItemReport,
        requesting_user: Optional[User] = None,
    ) -> Dict[str, Any]:
        """Convert ItemReport model to privacy-compliant response dictionary based on actor permissions."""
        is_owner = requesting_user and report.created_by == requesting_user.user_id
        is_staff_or_admin = requesting_user and requesting_user.role in (UserRole.STAFF, UserRole.ADMIN)

        base_data: Dict[str, Any] = {
            "report_id": report.report_id,
            "case_reference": report.case_reference,
            "report_type": report.report_type,
            "category_id": report.category_id,
            "category_name": report.category.category_name if report.category else None,
            "item_name": report.item_name,
            "description": report.description,
            "date_reported": report.date_reported,
            "date_lost_found": report.date_lost_found,
            "location": report.location,
            "colour": report.colour,
            "brand": report.brand,
            "distinguishing_marks": report.distinguishing_marks,
            "moderation_status": report.moderation_status,
            "lifecycle_status": report.lifecycle_status,
            "created_at": report.created_at,
            "lost_item": None,
            "found_item": None,
        }

        # Subtypes
        if report.lost_item:
            base_data["lost_item"] = {
                "last_seen_location": report.lost_item.last_seen_location,
                "reward_offered": report.lost_item.reward_offered,
            }

        if report.found_item:
            custody_name = (
                report.found_item.custody_location.name
                if report.found_item.custody_location
                else None
            )
            base_data["found_item"] = {
                "found_location": report.found_item.found_location,
                "custody_location_id": report.found_item.custody_location_id,
                "custody_location_name": custody_name,
            }

        # Privileged fields: strictly restricted to owner or staff/admin
        if is_owner or is_staff_or_admin:
            base_data["created_by"] = report.created_by
            base_data["creator_name"] = report.creator.full_name if report.creator else None
            base_data["contact_preference"] = report.contact_preference
            base_data["contact_info_restricted"] = report.contact_info_restricted

            if report.found_item and is_staff_or_admin:
                custody_loc = report.found_item.custody_location
                base_data["found_item_staff"] = {
                    "found_location": report.found_item.found_location,
                    "custody_location_id": report.found_item.custody_location_id,
                    "custody_location_name": custody_loc.name if custody_loc else None,
                    "storage_reference": report.found_item.storage_reference,
                    "restricted_custody_details": custody_loc.restricted_details if custody_loc else None,
                }

            if report.status_history:
                base_data["status_history"] = [
                    {
                        "history_id": h.history_id,
                        "report_id": h.report_id,
                        "previous_lifecycle_status": h.previous_lifecycle_status,
                        "new_lifecycle_status": h.new_lifecycle_status,
                        "previous_moderation_status": h.previous_moderation_status,
                        "new_moderation_status": h.new_moderation_status,
                        "changed_by": h.changed_by,
                        "reason": h.reason,
                        "changed_at": h.changed_at,
                    }
                    for h in report.status_history
                ]

        return base_data
