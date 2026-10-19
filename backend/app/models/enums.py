from enum import Enum
from typing import Any, List, Type


def enum_values(enum_cls: Type[Enum]) -> List[Any]:
    """Extract string values from Enum class for SQLAlchemy Enum column constraints."""
    return [e.value for e in enum_cls]


class UserRole(str, Enum):
    USER = "user"
    STAFF = "staff"
    ADMIN = "admin"


class ReportType(str, Enum):
    LOST = "lost"
    FOUND = "found"


class ModerationStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    VERIFIED = "verified"
    REJECTED = "rejected"


class LifecycleStatus(str, Enum):
    OPEN = "open"
    MATCHED = "matched"
    CLAIMED = "claimed"
    RETURNED = "returned"
    ARCHIVED = "archived"
    DISPOSED = "disposed"


class ClaimStatus(str, Enum):
    PENDING = "pending"
    MORE_INFORMATION_REQUESTED = "more_information_requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class MatchStatus(str, Enum):
    NEW = "new"
    REVIEWED = "reviewed"
    DISMISSED = "dismissed"
    CONFIRMED = "confirmed"


class NotificationType(str, Enum):
    MATCH_FOUND = "match_found"
    CLAIM_UPDATE = "claim_update"
    REPORT_STATUS = "report_status"
    SYSTEM = "system"
