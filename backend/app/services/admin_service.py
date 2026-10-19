import json
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.claim import Claim, Return
from app.models.enums import ClaimStatus, LifecycleStatus, ModerationStatus, ReportType, UserRole
from app.models.history import AuditLog
from app.models.report import ItemReport
from app.models.user import StaffProfile, User
from app.schemas.admin import (
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
    DashboardLifecycleCounts,
    DashboardStatsResponse,
)


class AdminService:
    """Service layer for administrator user management and operational dashboard statistics."""

    @staticmethod
    def get_dashboard_stats(db: Session) -> DashboardStatsResponse:
        """Calculate system-wide operational counters and metrics (FR-23 compliance)."""
        total_reports = db.scalar(select(func.count(ItemReport.report_id))) or 0
        total_lost = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.report_type == ReportType.LOST)
        ) or 0
        total_found = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.report_type == ReportType.FOUND)
        ) or 0

        # Lifecycle counts
        c_open = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.lifecycle_status == LifecycleStatus.OPEN)
        ) or 0
        c_matched = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.lifecycle_status == LifecycleStatus.MATCHED)
        ) or 0
        c_claimed = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.lifecycle_status == LifecycleStatus.CLAIMED)
        ) or 0
        c_returned = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.lifecycle_status == LifecycleStatus.RETURNED)
        ) or 0
        c_archived = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.lifecycle_status == LifecycleStatus.ARCHIVED)
        ) or 0
        c_disposed = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.lifecycle_status == LifecycleStatus.DISPOSED)
        ) or 0

        # Moderation counts
        mod_pending = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.moderation_status == ModerationStatus.PENDING_REVIEW)
        ) or 0
        mod_verified = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.moderation_status == ModerationStatus.VERIFIED)
        ) or 0
        mod_rejected = db.scalar(
            select(func.count(ItemReport.report_id)).where(ItemReport.moderation_status == ModerationStatus.REJECTED)
        ) or 0

        # Claims & Returns counts
        total_claims = db.scalar(select(func.count(Claim.claim_id))) or 0
        pending_claims = db.scalar(
            select(func.count(Claim.claim_id)).where(Claim.status == ClaimStatus.PENDING)
        ) or 0
        approved_claims = db.scalar(
            select(func.count(Claim.claim_id)).where(Claim.status == ClaimStatus.APPROVED)
        ) or 0
        rejected_claims = db.scalar(
            select(func.count(Claim.claim_id)).where(Claim.status == ClaimStatus.REJECTED)
        ) or 0
        total_returns = db.scalar(select(func.count(Return.return_id))) or 0

        # User counts
        total_users = db.scalar(select(func.count(User.user_id))) or 0
        total_staff = db.scalar(
            select(func.count(User.user_id)).where(User.role.in_([UserRole.STAFF, UserRole.ADMIN]))
        ) or 0

        return DashboardStatsResponse(
            total_reports=total_reports,
            total_lost_reports=total_lost,
            total_found_reports=total_found,
            counts_by_lifecycle=DashboardLifecycleCounts(
                open=c_open,
                matched=c_matched,
                claimed=c_claimed,
                returned=c_returned,
                archived=c_archived,
                disposed=c_disposed,
            ),
            pending_moderation_reports=mod_pending,
            verified_reports=mod_verified,
            rejected_reports=mod_rejected,
            total_claims=total_claims,
            pending_claims=pending_claims,
            approved_claims=approved_claims,
            rejected_claims=rejected_claims,
            total_returns=total_returns,
            total_users=total_users,
            total_staff=total_staff,
        )

    @staticmethod
    def list_users(
        db: Session,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> List[User]:
        """Administrator list of registered users."""
        query = (
            select(User)
            .options(joinedload(User.staff_profile))
            .order_by(User.created_at.desc())
        )

        if role:
            query = query.where(User.role == role)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        if search:
            s = f"%{search.strip()}%"
            query = query.where(or_(User.full_name.ilike(s), User.email.ilike(s)))

        offset = (page - 1) * page_size
        return list(db.scalars(query.offset(offset).limit(page_size)).unique().all())

    @staticmethod
    def update_user_role(
        db: Session,
        target_user_id: int,
        update_in: AdminUserRoleUpdate,
        admin_user: User,
    ) -> User:
        """Modify user role and manage staff department profile."""
        target_user = db.scalar(
            select(User)
            .options(joinedload(User.staff_profile))
            .where(User.user_id == target_user_id)
        )
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User #{target_user_id} not found.",
            )

        # Safety Invariant: Disallow self-demotion
        if target_user.user_id == admin_user.user_id and update_in.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators are not permitted to demote their own account to prevent system lockout.",
            )

        old_role = target_user.role.value
        target_user.role = update_in.role

        # If promoting to STAFF, ensure StaffProfile exists
        if update_in.role == UserRole.STAFF:
            dept = update_in.department.strip() if update_in.department else "General Operations"
            if target_user.staff_profile:
                target_user.staff_profile.department = dept
                if update_in.employee_code is not None:
                    target_user.staff_profile.employee_code = update_in.employee_code.strip() or None
            else:
                profile = StaffProfile(
                    user_id=target_user.user_id,
                    department=dept,
                    employee_code=update_in.employee_code.strip() if update_in.employee_code else None,
                )
                db.add(profile)

        # Audit Log
        audit = AuditLog(
            actor_user_id=admin_user.user_id,
            action="USER_ROLE_CHANGED",
            entity_type="User",
            entity_id=str(target_user.user_id),
            summary=json.dumps({
                "target_user_id": target_user.user_id,
                "target_email": target_user.email,
                "old_role": old_role,
                "new_role": update_in.role.value,
            }),
        )
        db.add(audit)

        db.commit()
        db.refresh(target_user)
        return target_user

    @staticmethod
    def update_user_status(
        db: Session,
        target_user_id: int,
        status_in: AdminUserStatusUpdate,
        admin_user: User,
    ) -> User:
        """Suspend or activate a user account."""
        target_user = db.scalar(
            select(User)
            .options(joinedload(User.staff_profile))
            .where(User.user_id == target_user_id)
        )
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User #{target_user_id} not found.",
            )

        # Safety Invariant: Disallow self-deactivation
        if target_user.user_id == admin_user.user_id and not status_in.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot deactivate their own account.",
            )

        target_user.is_active = status_in.is_active

        # Audit Log
        audit = AuditLog(
            actor_user_id=admin_user.user_id,
            action="USER_STATUS_CHANGED",
            entity_type="User",
            entity_id=str(target_user.user_id),
            summary=json.dumps({
                "target_user_id": target_user.user_id,
                "target_email": target_user.email,
                "is_active": status_in.is_active,
                "reason": status_in.reason.strip(),
            }),
        )
        db.add(audit)

        db.commit()
        db.refresh(target_user)
        return target_user
