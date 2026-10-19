import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.claim import Claim, Return
from app.models.custody import CustodyLocation
from app.models.enums import ClaimStatus, LifecycleStatus, NotificationType, ReportType
from app.models.history import AuditLog, ReportStatusHistory
from app.models.notification import Notification
from app.models.report import FoundItem, ItemReport
from app.models.user import User
from app.schemas.handover import (
    CustodyTransferRequest,
    ReportLifecycleActionRequest,
    ReturnCreate,
)


class ReturnService:
    """Business logic for custody transfers, return handovers, and lifecycle retention."""

    @staticmethod
    def record_return(
        db: Session,
        claim_id: int,
        return_in: ReturnCreate,
        staff_user: User,
    ) -> Return:
        """Record an official verified handover for an approved claim."""
        claim = db.scalar(
            select(Claim)
            .options(
                joinedload(Claim.report),
                joinedload(Claim.claimant),
                joinedload(Claim.return_record),
            )
            .where(Claim.claim_id == claim_id)
        )
        if not claim:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Claim #{claim_id} not found.",
            )

        report = claim.report

        # Invariant 1: Claim must be APPROVED
        if claim.status != ClaimStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot record return handover: claim is in status '{claim.status.value}', expected 'approved'.",
            )

        # Invariant 2: A return handover cannot already be recorded
        if claim.return_record is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A return handover confirmation has already been recorded for this claim.",
            )

        # Invariant 3: Report cannot already be in RETURNED lifecycle status
        if report.lifecycle_status == LifecycleStatus.RETURNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This item report has already been returned.",
            )

        now = datetime.now(timezone.utc)

        # 1. Create Return entity
        return_record = Return(
            claim_id=claim.claim_id,
            recorded_by=staff_user.user_id,
            returned_at=now,
            recipient_confirmation=return_in.recipient_confirmation.strip(),
            condition_of_item=return_in.condition_of_item.strip() if return_in.condition_of_item else None,
            notes=return_in.notes.strip() if return_in.notes else None,
            created_at=now,
        )
        db.add(return_record)
        db.flush()

        # 2. Update report lifecycle status to RETURNED
        old_status = report.lifecycle_status.value
        report.lifecycle_status = LifecycleStatus.RETURNED

        # 3. Record status history
        history = ReportStatusHistory(
            report_id=report.report_id,
            previous_lifecycle_status=old_status,
            new_lifecycle_status=LifecycleStatus.RETURNED.value,
            changed_by=staff_user.user_id,
            reason=f"Handover recorded by {staff_user.full_name}: {return_in.recipient_confirmation.strip()}",
        )
        db.add(history)

        # 4. Record Audit Log
        audit = AuditLog(
            actor_user_id=staff_user.user_id,
            action="ITEM_RETURNED",
            entity_type="Return",
            entity_id=str(return_record.return_id),
            summary=json.dumps({
                "report_id": report.report_id,
                "claim_id": claim.claim_id,
                "case_reference": report.case_reference,
                "recipient_name": claim.claimant.full_name if claim.claimant else None,
                "confirmation": return_in.recipient_confirmation.strip(),
            }),
        )
        db.add(audit)

        # 5. In-app notification to Claimant
        notif_claimant = Notification(
            user_id=claim.claimed_by,
            title="Item Handover Completed",
            message=f"Handover of your item '{report.item_name}' ({report.case_reference}) has been officially completed and recorded.",
            type=NotificationType.CLAIM_UPDATE,
            related_report_id=report.report_id,
            related_claim_id=claim.claim_id,
        )
        db.add(notif_claimant)

        # 6. In-app notification to Found Item Finder (if different user)
        if report.created_by != claim.claimed_by:
            notif_finder = Notification(
                user_id=report.created_by,
                title="Found Item Returned to Owner",
                message=f"The item '{report.item_name}' ({report.case_reference}) you found has been safely returned to its verified owner.",
                type=NotificationType.REPORT_STATUS,
                related_report_id=report.report_id,
                related_claim_id=claim.claim_id,
            )
            db.add(notif_finder)

        db.commit()
        db.refresh(return_record)
        return return_record

    @staticmethod
    def transfer_custody(
        db: Session,
        report_id: int,
        transfer_in: CustodyTransferRequest,
        staff_user: User,
    ) -> ItemReport:
        """Transfer found item physical custody or update storage bin."""
        report = db.scalar(
            select(ItemReport)
            .options(joinedload(ItemReport.found_item))
            .where(ItemReport.report_id == report_id)
        )
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report #{report_id} not found.",
            )

        if report.report_type != ReportType.FOUND or not report.found_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custody transfer applies only to found item reports.",
            )

        if report.lifecycle_status in (
            LifecycleStatus.RETURNED,
            LifecycleStatus.ARCHIVED,
            LifecycleStatus.DISPOSED,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transfer custody of item in lifecycle status '{report.lifecycle_status.value}'.",
            )

        # Validate destination custody location
        custody = db.scalar(
            select(CustodyLocation).where(
                CustodyLocation.custody_location_id == transfer_in.new_custody_location_id
            )
        )
        if not custody or not custody.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Active custody location #{transfer_in.new_custody_location_id} not found.",
            )

        old_custody_id = report.found_item.custody_location_id
        report.found_item.custody_location_id = custody.custody_location_id

        if transfer_in.storage_reference is not None:
            report.found_item.storage_reference = transfer_in.storage_reference.strip() or None

        # Record Status History
        history = ReportStatusHistory(
            report_id=report.report_id,
            previous_lifecycle_status=report.lifecycle_status.value,
            new_lifecycle_status=report.lifecycle_status.value,
            new_custody_location_id=custody.custody_location_id,
            changed_by=staff_user.user_id,
            reason=f"Custody transferred from #{old_custody_id} to #{custody.custody_location_id}: {transfer_in.reason.strip()}",
        )
        db.add(history)

        # Record Audit Log
        audit = AuditLog(
            actor_user_id=staff_user.user_id,
            action="CUSTODY_TRANSFERRED",
            entity_type="ItemReport",
            entity_id=str(report.report_id),
            summary=json.dumps({
                "from_custody": old_custody_id,
                "to_custody": custody.custody_location_id,
                "reason": transfer_in.reason.strip(),
            }),
        )
        db.add(audit)

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def archive_report(
        db: Session,
        report_id: int,
        action_in: ReportLifecycleActionRequest,
        staff_user: User,
    ) -> ItemReport:
        """Staff/Admin archives report under policy-controlled workflow."""
        if not action_in.confirm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Explicit confirmation ('confirm': true) is required to archive a report.",
            )

        report = db.scalar(
            select(ItemReport)
            .options(joinedload(ItemReport.claims))
            .where(ItemReport.report_id == report_id)
        )
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report #{report_id} not found.",
            )

        # Invariant: Cannot archive if active claim exists
        has_active_claim = any(
            c.status in (ClaimStatus.PENDING, ClaimStatus.MORE_INFORMATION_REQUESTED, ClaimStatus.APPROVED)
            for c in report.claims
        )
        if has_active_claim:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot archive report with an active or approved claim.",
            )

        old_status = report.lifecycle_status.value
        report.lifecycle_status = LifecycleStatus.ARCHIVED

        history = ReportStatusHistory(
            report_id=report.report_id,
            previous_lifecycle_status=old_status,
            new_lifecycle_status=LifecycleStatus.ARCHIVED.value,
            changed_by=staff_user.user_id,
            reason=f"Archived by staff: {action_in.reason.strip()}",
        )
        db.add(history)

        audit = AuditLog(
            actor_user_id=staff_user.user_id,
            action="REPORT_ARCHIVED",
            entity_type="ItemReport",
            entity_id=str(report.report_id),
            summary=json.dumps({"reason": action_in.reason.strip()}),
        )
        db.add(audit)

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def dispose_report(
        db: Session,
        report_id: int,
        action_in: ReportLifecycleActionRequest,
        staff_user: User,
    ) -> ItemReport:
        """Staff/Admin disposes of an unclaimed found item under strict policy."""
        if not action_in.confirm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Explicit confirmation ('confirm': true) is required to dispose of an item.",
            )

        report = db.scalar(
            select(ItemReport)
            .options(joinedload(ItemReport.claims))
            .where(ItemReport.report_id == report_id)
        )
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report #{report_id} not found.",
            )

        if report.report_type != ReportType.FOUND:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Disposal applies only to physical found items in custody.",
            )

        if report.lifecycle_status == LifecycleStatus.RETURNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Returned items cannot be disposed.",
            )

        has_active_claim = any(
            c.status in (ClaimStatus.PENDING, ClaimStatus.MORE_INFORMATION_REQUESTED, ClaimStatus.APPROVED)
            for c in report.claims
        )
        if has_active_claim:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot dispose of item with active or approved claim.",
            )

        old_status = report.lifecycle_status.value
        report.lifecycle_status = LifecycleStatus.DISPOSED

        history = ReportStatusHistory(
            report_id=report.report_id,
            previous_lifecycle_status=old_status,
            new_lifecycle_status=LifecycleStatus.DISPOSED.value,
            changed_by=staff_user.user_id,
            reason=f"Disposed under policy: {action_in.reason.strip()}",
        )
        db.add(history)

        audit = AuditLog(
            actor_user_id=staff_user.user_id,
            action="ITEM_DISPOSED",
            entity_type="ItemReport",
            entity_id=str(report.report_id),
            summary=json.dumps({"reason": action_in.reason.strip()}),
        )
        db.add(audit)

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def format_return_dict(return_record: Return) -> Dict[str, Any]:
        """Format Return record for response."""
        claim = return_record.claim
        report = claim.report if claim else None
        return {
            "return_id": return_record.return_id,
            "claim_id": return_record.claim_id,
            "report_id": report.report_id if report else 0,
            "case_reference": report.case_reference if report else None,
            "item_name": report.item_name if report else None,
            "recorded_by": return_record.recorded_by,
            "officer_name": return_record.officer.full_name if return_record.officer else None,
            "returned_at": return_record.returned_at,
            "recipient_confirmation": return_record.recipient_confirmation,
            "condition_of_item": return_record.condition_of_item,
            "notes": return_record.notes,
            "created_at": return_record.created_at,
        }
