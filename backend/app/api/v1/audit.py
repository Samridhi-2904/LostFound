from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_admin
from app.models.history import AuditLog
from app.models.user import User
from app.schemas.handover import AuditLogResponse

router = APIRouter(prefix="/admin/audit-logs", tags=["Administration & Audit"])


@router.get(
    "",
    response_model=List[AuditLogResponse],
    summary="List system audit log records (Administrator only)",
)
def list_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action name"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    actor_user_id: Optional[int] = Query(None, description="Filter by actor user ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Any:
    """Administrator audit log review endpoint."""
    query = (
        select(AuditLog)
        .options(joinedload(AuditLog.actor))
        .order_by(AuditLog.timestamp.desc())
    )

    if action:
        query = query.where(AuditLog.action == action.strip())
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type.strip())
    if actor_user_id:
        query = query.where(AuditLog.actor_user_id == actor_user_id)

    offset = (page - 1) * page_size
    logs = db.scalars(query.offset(offset).limit(page_size)).unique().all()

    return [
        {
            "audit_id": log.audit_id,
            "actor_user_id": log.actor_user_id,
            "actor_name": log.actor.full_name if log.actor else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "timestamp": log.timestamp,
            "summary": log.summary,
            "correlation_id": log.correlation_id,
        }
        for log in logs
    ]
