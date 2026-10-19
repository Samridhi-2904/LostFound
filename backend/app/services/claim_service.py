import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.claim import Claim
from app.models.enums import (
    ClaimStatus,
    LifecycleStatus,
    NotificationType,
    ReportType,
    UserRole,
)
from app.models.history import AuditLog, ReportStatusHistory
from app.models.notification import Notification
from app.models.report import ItemReport
from app.models.user import User
from app.schemas.claim import ClaimCreate, ClaimRespondMoreInfo, ClaimReviewRequest


class ClaimService:
    """Business logic for claim submission, review workflows, and privacy boundaries."""

    @staticmethod
    def get_by_id(db: Session, claim_id: int) -> Claim:
        """Fetch claim by ID or raise 404."""
        claim = db.scalar(
            select(Claim)
            .options(
                joinedload(Claim.report),
                joinedload(Claim.claimant),
                joinedload(Claim.reviewer),
                joinedload(Claim.return_record),
            )
            .where(Claim.claim_id == claim_id)
        )
        if not claim:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Claim #{claim_id} not found.",
            )
        return claim

    @staticmethod
    def create_claim(
        db: Session,
        report_id: int,
        claim_in: ClaimCreate,
        claimant: User,
    ) -> Claim:
        """Submit an ownership claim for an eligible found report."""
        report = db.scalar(
            select(ItemReport)
            .options(
                joinedload(ItemReport.claims),
                joinedload(ItemReport.creator),
            )
            .where(ItemReport.report_id == report_id)
        )
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report #{report_id} not found.",
            )

        # Invariant 1: Claims can only be made against FOUND reports
        if report.report_type != ReportType.FOUND:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Claims can only be filed against found item reports.",
            )

        # Invariant 2: Report must be in an eligible lifecycle state
        if report.lifecycle_status in (
            LifecycleStatus.RETURNED,
            LifecycleStatus.ARCHIVED,
            LifecycleStatus.DISPOSED,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Report cannot be claimed in its current lifecycle status: '{report.lifecycle_status.value}'.",
            )

        # Invariant 3: Finder cannot claim their own found report
        if report.created_by == claimant.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot submit an ownership claim for an item you reported as found.",
            )

        # Invariant 4: Duplicate active claim prevention
        active_claim = db.scalar(
            select(Claim).where(
                Claim.report_id == report_id,
                Claim.claimed_by == claimant.user_id,
                Claim.status.in_([
                    ClaimStatus.PENDING,
                    ClaimStatus.MORE_INFORMATION_REQUESTED,
                    ClaimStatus.APPROVED,
                ]),
            )
        )
        if active_claim:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have an active claim (#{active_claim.claim_id}) in status '{active_claim.status.value}' for this item.",
            )

        # 1. Create Claim
        now = datetime.now(timezone.utc)
        claim = Claim(
            report_id=report.report_id,
            claimed_by=claimant.user_id,
            ownership_evidence=claim_in.ownership_evidence.strip(),
            status=ClaimStatus.PENDING,
            submitted_at=now,
        )
        db.add(claim)
        db.flush()  # allocate claim_id

        # 2. Update Report Lifecycle Status to CLAIMED if currently OPEN or MATCHED
        if report.lifecycle_status in (LifecycleStatus.OPEN, LifecycleStatus.MATCHED):
            old_status = report.lifecycle_status.value
            report.lifecycle_status = LifecycleStatus.CLAIMED

            history = ReportStatusHistory(
                report_id=report.report_id,
                previous_lifecycle_status=old_status,
                new_lifecycle_status=LifecycleStatus.CLAIMED.value,
                changed_by=claimant.user_id,
                reason=f"Claim #{claim.claim_id} submitted by {claimant.full_name}.",
            )
            db.add(history)

        # 3. Notification to Claimant
        notif_claimant = Notification(
            user_id=claimant.user_id,
            title="Claim Submitted",
            message=f"Your claim #{claim.claim_id} for '{report.item_name}' ({report.case_reference}) has been received and is pending staff review.",
            type=NotificationType.CLAIM_UPDATE,
            related_report_id=report.report_id,
            related_claim_id=claim.claim_id,
        )
        db.add(notif_claimant)

        # 4. Notification to Found Item Reporter (privacy-safe, no evidence revealed)
        if report.created_by != claimant.user_id:
            notif_finder = Notification(
                user_id=report.created_by,
                title="Claim Filed on Found Item",
                message=f"A potential owner submitted a claim for found item '{report.item_name}' ({report.case_reference}). Staff will evaluate the evidence.",
                type=NotificationType.CLAIM_UPDATE,
                related_report_id=report.report_id,
                related_claim_id=claim.claim_id,
            )
            db.add(notif_finder)

        # 5. Audit Log
        audit = AuditLog(
            actor_user_id=claimant.user_id,
            action="CLAIM_SUBMITTED",
            entity_type="Claim",
            entity_id=str(claim.claim_id),
            summary=json.dumps({"report_id": report_id, "case_reference": report.case_reference}),
        )
        db.add(audit)

        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def review_claim(
        db: Session,
        claim_id: int,
        review_in: ClaimReviewRequest,
        staff_user: User,
    ) -> Claim:
        """Staff/Admin reviews claim: approve, reject, or request more information."""
        claim = ClaimService.get_by_id(db, claim_id)
        report = claim.report

        # Invariant: Disallow self-review
        if claim.claimed_by == staff_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reviewers are not permitted to review or approve their own claims.",
            )

        # Invariant: Cannot re-review already finalized approved or cancelled claims
        if claim.status in (ClaimStatus.APPROVED, ClaimStatus.CANCELLED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Claim is already finalized with status '{claim.status.value}'.",
            )

        decision = review_in.decision.lower().strip()
        now = datetime.now(timezone.utc)

        claim.reviewed_by = staff_user.user_id
        claim.reviewed_at = now
        claim.review_notes = review_in.notes.strip() if review_in.notes else None

        if decision == "approve":
            claim.status = ClaimStatus.APPROVED
            claim.decision_reason = (
                review_in.decision_reason.strip()
                if review_in.decision_reason
                else "Ownership evidence verified by staff."
            )

            # Report remains in CLAIMED status waiting for formal handover
            report.lifecycle_status = LifecycleStatus.CLAIMED

            # In-app notification for claimant
            notif = Notification(
                user_id=claim.claimed_by,
                title="Claim Approved!",
                message=f"Your claim for '{report.item_name}' ({report.case_reference}) was APPROVED. Please present your identification at the custody facility to collect your item.",
                type=NotificationType.CLAIM_UPDATE,
                related_report_id=report.report_id,
                related_claim_id=claim.claim_id,
            )
            db.add(notif)

            action_type = "CLAIM_APPROVED"

        elif decision == "reject":
            claim.status = ClaimStatus.REJECTED
            claim.decision_reason = (
                review_in.decision_reason.strip()
                if review_in.decision_reason
                else "Ownership evidence was insufficient or did not match custody records."
            )

            # Check if there are other active claims on this report
            active_claims_count = db.scalar(
                select(Claim).where(
                    Claim.report_id == report.report_id,
                    Claim.claim_id != claim.claim_id,
                    Claim.status.in_([
                        ClaimStatus.PENDING,
                        ClaimStatus.MORE_INFORMATION_REQUESTED,
                        ClaimStatus.APPROVED,
                    ]),
                )
            )

            # If no other active claims exist, revert report to OPEN
            if not active_claims_count:
                old_status = report.lifecycle_status.value
                report.lifecycle_status = LifecycleStatus.OPEN

                history = ReportStatusHistory(
                    report_id=report.report_id,
                    previous_lifecycle_status=old_status,
                    new_lifecycle_status=LifecycleStatus.OPEN.value,
                    changed_by=staff_user.user_id,
                    reason=f"Claim #{claim.claim_id} rejected. Reverting report to Open.",
                )
                db.add(history)

            # In-app notification for claimant
            notif = Notification(
                user_id=claim.claimed_by,
                title="Claim Decision Update",
                message=f"Your claim for '{report.item_name}' was not approved: {claim.decision_reason}",
                type=NotificationType.CLAIM_UPDATE,
                related_report_id=report.report_id,
                related_claim_id=claim.claim_id,
            )
            db.add(notif)

            action_type = "CLAIM_REJECTED"

        elif decision in ("request-info", "request_info", "more-info"):
            claim.status = ClaimStatus.MORE_INFORMATION_REQUESTED
            claim.decision_reason = (
                review_in.decision_reason.strip()
                if review_in.decision_reason
                else "Additional documentation or details required to verify ownership."
            )

            notif = Notification(
                user_id=claim.claimed_by,
                title="More Information Requested on Claim",
                message=f"Staff requested more details for your claim on '{report.item_name}': {claim.decision_reason}",
                type=NotificationType.CLAIM_UPDATE,
                related_report_id=report.report_id,
                related_claim_id=claim.claim_id,
            )
            db.add(notif)

            action_type = "CLAIM_MORE_INFO_REQUESTED"

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid decision '{review_in.decision}'. Expected 'approve', 'reject', or 'request-info'.",
            )

        # Audit Log
        audit = AuditLog(
            actor_user_id=staff_user.user_id,
            action=action_type,
            entity_type="Claim",
            entity_id=str(claim.claim_id),
            summary=json.dumps({
                "status": claim.status.value,
                "decision_reason": claim.decision_reason,
            }),
        )
        db.add(audit)

        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def respond_more_info(
        db: Session,
        claim_id: int,
        response_in: ClaimRespondMoreInfo,
        claimant: User,
    ) -> Claim:
        """Claimant provides additional ownership details in response to staff request."""
        claim = ClaimService.get_by_id(db, claim_id)

        # Ownership check
        if claim.claimed_by != claimant.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only respond to your own claims.",
            )

        # Status check
        if claim.status != ClaimStatus.MORE_INFORMATION_REQUESTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Claim is in status '{claim.status.value}'. Additional info can only be provided when requested.",
            )

        now = datetime.now(timezone.utc)
        claim.ownership_evidence += f"\n\n--- Claimant Additional Evidence ({now.isoformat()}) ---\n" + response_in.additional_evidence.strip()
        claim.status = ClaimStatus.PENDING

        audit = AuditLog(
            actor_user_id=claimant.user_id,
            action="CLAIM_ADDITIONAL_EVIDENCE_PROVIDED",
            entity_type="Claim",
            entity_id=str(claim.claim_id),
            summary=json.dumps({"claim_id": claim.claim_id}),
        )
        db.add(audit)

        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def cancel_claim(db: Session, claim_id: int, claimant: User) -> Claim:
        """Claimant cancels their active claim."""
        claim = ClaimService.get_by_id(db, claim_id)

        if claim.claimed_by != claimant.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only cancel your own claims.",
            )

        if claim.status == ClaimStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Approved claims cannot be cancelled directly. Contact staff.",
            )

        claim.status = ClaimStatus.CANCELLED
        report = claim.report

        # If no other active claims exist, revert report to OPEN
        other_active = db.scalar(
            select(Claim).where(
                Claim.report_id == report.report_id,
                Claim.claim_id != claim.claim_id,
                Claim.status.in_([
                    ClaimStatus.PENDING,
                    ClaimStatus.MORE_INFORMATION_REQUESTED,
                    ClaimStatus.APPROVED,
                ]),
            )
        )
        if not other_active and report.lifecycle_status == LifecycleStatus.CLAIMED:
            report.lifecycle_status = LifecycleStatus.OPEN

            history = ReportStatusHistory(
                report_id=report.report_id,
                previous_lifecycle_status=LifecycleStatus.CLAIMED.value,
                new_lifecycle_status=LifecycleStatus.OPEN.value,
                changed_by=claimant.user_id,
                reason=f"Claim #{claim.claim_id} was cancelled by claimant.",
            )
            db.add(history)

        audit = AuditLog(
            actor_user_id=claimant.user_id,
            action="CLAIM_CANCELLED",
            entity_type="Claim",
            entity_id=str(claim.claim_id),
            summary=json.dumps({"claim_id": claim.claim_id}),
        )
        db.add(audit)

        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def format_claim_dict(
        claim: Claim,
        requesting_user: User,
    ) -> Dict[str, Any]:
        """Format claim with strict privacy filters: evidence and notes are privileged."""
        is_owner = claim.claimed_by == requesting_user.user_id
        is_staff_or_admin = requesting_user.role in (UserRole.STAFF, UserRole.ADMIN)

        if not is_owner and not is_staff_or_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to view this claim.",
            )

        data: Dict[str, Any] = {
            "claim_id": claim.claim_id,
            "report_id": claim.report_id,
            "case_reference": claim.report.case_reference if claim.report else None,
            "item_name": claim.report.item_name if claim.report else None,
            "claimed_by": claim.claimed_by,
            "claimant_name": claim.claimant.full_name if claim.claimant else None,
            "claimant_email": claim.claimant.email if (is_staff_or_admin or is_owner) and claim.claimant else None,
            "ownership_evidence": claim.ownership_evidence,
            "status": claim.status,
            "submitted_at": claim.submitted_at,
            "reviewed_by": claim.reviewed_by if is_staff_or_admin else None,
            "reviewer_name": claim.reviewer.full_name if claim.reviewer and is_staff_or_admin else None,
            "reviewed_at": claim.reviewed_at,
            "review_notes": claim.review_notes if is_staff_or_admin else None,  # Staff notes only to staff
            "decision_reason": claim.decision_reason,
            "has_return": claim.return_record is not None,
            "created_at": claim.created_at,
            "updated_at": claim.updated_at,
        }
        return data
