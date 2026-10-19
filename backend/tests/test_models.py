from datetime import datetime, timezone
import pytest
from sqlalchemy import select, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine
from app.models.category import Category
from app.models.claim import Claim, Return
from app.models.custody import CustodyLocation
from app.models.enums import (
    ClaimStatus,
    LifecycleStatus,
    MatchStatus,
    ModerationStatus,
    NotificationType,
    ReportType,
    UserRole,
)
from app.models.history import AuditLog, ReportStatusHistory
from app.models.match import MatchSuggestion
from app.models.notification import Notification
from app.models.report import FoundItem, ItemImage, ItemReport, LostItem
from app.models.user import StaffProfile, User


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh in-memory SQLite database session for isolated model testing."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=test_engine)
    SessionTest = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = SessionTest()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


def test_table_inventory():
    """Verify all 13 domain model tables exist in the SQLAlchemy declarative metadata."""
    expected_tables = {
        "users",
        "staff_profiles",
        "categories",
        "custody_locations",
        "item_reports",
        "lost_items",
        "found_items",
        "item_images",
        "match_suggestions",
        "claims",
        "returns",
        "notifications",
        "report_status_histories",
        "audit_logs",
    }
    actual_tables = set(Base.metadata.tables.keys())
    for table in expected_tables:
        assert table in actual_tables, f"Missing table: {table}"


def test_user_and_staff_profile(db_session: Session):
    """Test User persistence and StaffProfile relationship."""
    user = User(
        full_name="Jane Doe",
        email="jane.doe@example.com",
        phone="555-0199",
        password_hash="$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        role=UserRole.STAFF,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.user_id is not None
    assert user.role == UserRole.STAFF

    # Add staff profile
    profile = StaffProfile(
        user_id=user.user_id,
        department="Campus Security",
        employee_code="SEC-104",
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(user)

    assert user.staff_profile is not None
    assert user.staff_profile.department == "Campus Security"
    assert user.staff_profile.employee_code == "SEC-104"


def test_category_and_custody_location(db_session: Session):
    """Test Category and CustodyLocation persistence with restricted details."""
    category = Category(
        category_name="Electronics",
        description="Mobile phones, laptops, and tablets",
        is_active=True,
    )
    custody = CustodyLocation(
        name="Main Security Locker Room",
        description="Vault in Administration Building B",
        restricted_details="Room B-104, Keycard Auth Required",
        is_active=True,
    )
    db_session.add_all([category, custody])
    db_session.commit()

    assert category.category_id is not None
    assert custody.custody_location_id is not None
    assert custody.restricted_details == "Room B-104, Keycard Auth Required"


def test_lost_and_found_item_reports(db_session: Session):
    """Test creation of lost and found item reports with respective subtype models."""
    user = User(
        full_name="Alex Smith",
        email="alex@example.com",
        password_hash="dummyhash",
        role=UserRole.USER,
    )
    category = Category(category_name="Personal Items")
    custody = CustodyLocation(
        name="Student Union Desk",
        restricted_details="Cabinet 3, safe combo with manager",
    )
    db_session.add_all([user, category, custody])
    db_session.commit()

    # 1. Lost item report
    lost_report = ItemReport(
        case_reference="LR-2026-0001",
        created_by=user.user_id,
        category_id=category.category_id,
        report_type=ReportType.LOST,
        item_name="Blue Herschel Backpack",
        description="Contains notebook and stationery",
        date_lost_found=datetime.now(timezone.utc),
        location="Library 2nd Floor",
        colour="Blue",
        brand="Herschel",
        contact_preference="in_app",
        moderation_status=ModerationStatus.VERIFIED,
        lifecycle_status=LifecycleStatus.OPEN,
    )
    db_session.add(lost_report)
    db_session.commit()

    lost_item = LostItem(
        report_id=lost_report.report_id,
        last_seen_location="Near study desk 12",
        reward_offered="Small reward",
    )
    db_session.add(lost_item)
    db_session.commit()
    db_session.refresh(lost_report)

    assert lost_report.lost_item is not None
    assert lost_report.lost_item.last_seen_location == "Near study desk 12"

    # 2. Found item report
    found_report = ItemReport(
        case_reference="FR-2026-0001",
        created_by=user.user_id,
        category_id=category.category_id,
        report_type=ReportType.FOUND,
        item_name="Blue Backpack",
        description="Found unattended in study area",
        date_lost_found=datetime.now(timezone.utc),
        location="Library",
        colour="Blue",
        contact_preference="in_app",
        moderation_status=ModerationStatus.VERIFIED,
        lifecycle_status=LifecycleStatus.OPEN,
    )
    db_session.add(found_report)
    db_session.commit()

    found_item = FoundItem(
        report_id=found_report.report_id,
        found_location="Library reading hall chair",
        custody_location_id=custody.custody_location_id,
        storage_reference="BIN-42",
    )
    db_session.add(found_item)
    db_session.commit()
    db_session.refresh(found_report)

    assert found_report.found_item is not None
    assert found_report.found_item.custody_location is not None
    assert found_report.found_item.custody_location.name == "Student Union Desk"


def test_match_suggestion_uniqueness(db_session: Session):
    """Test MatchSuggestion creation and unique constraint between report pair."""
    user = User(full_name="User", email="u@example.com", password_hash="hash")
    category = Category(category_name="Wallets")
    db_session.add_all([user, category])
    db_session.commit()

    lost_report = ItemReport(
        case_reference="LR-MATCH-01",
        created_by=user.user_id,
        category_id=category.category_id,
        report_type=ReportType.LOST,
        item_name="Leather Wallet",
        description="Brown leather wallet",
        date_lost_found=datetime.now(timezone.utc),
        location="Campus Center",
    )
    found_report = ItemReport(
        case_reference="FR-MATCH-01",
        created_by=user.user_id,
        category_id=category.category_id,
        report_type=ReportType.FOUND,
        item_name="Brown Wallet",
        description="Brown leather bifold wallet",
        date_lost_found=datetime.now(timezone.utc),
        location="Campus Center",
    )
    db_session.add_all([lost_report, found_report])
    db_session.commit()

    match1 = MatchSuggestion(
        lost_report_id=lost_report.report_id,
        found_report_id=found_report.report_id,
        score=0.88,
        match_reasons='{"keyword_match": "wallet", "colour_match": "brown"}',
        status=MatchStatus.NEW,
    )
    db_session.add(match1)
    db_session.commit()

    # Attempting duplicate pair should raise IntegrityError
    match2 = MatchSuggestion(
        lost_report_id=lost_report.report_id,
        found_report_id=found_report.report_id,
        score=0.90,
        match_reasons='{"duplicate": true}',
        status=MatchStatus.NEW,
    )
    db_session.add(match2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_claim_and_return_lifecycle(db_session: Session):
    """Test Claim submission and verified Return handover persistence."""
    claimant = User(full_name="Alice", email="alice@example.com", password_hash="h1")
    officer = User(full_name="Officer Bob", email="bob@example.com", password_hash="h2", role=UserRole.STAFF)
    cat = Category(category_name="Keys")
    db_session.add_all([claimant, officer, cat])
    db_session.commit()

    report = ItemReport(
        case_reference="FR-CLAIM-01",
        created_by=officer.user_id,
        category_id=cat.category_id,
        report_type=ReportType.FOUND,
        item_name="Keychain with Honda key",
        description="Silver Honda key with red lanyard",
        date_lost_found=datetime.now(timezone.utc),
        location="Parking Lot B",
        moderation_status=ModerationStatus.VERIFIED,
        lifecycle_status=LifecycleStatus.OPEN,
    )
    db_session.add(report)
    db_session.commit()

    claim = Claim(
        report_id=report.report_id,
        claimed_by=claimant.user_id,
        ownership_evidence="Has red lanyard with my student ID barcode sticker on the back",
        status=ClaimStatus.APPROVED,
        reviewed_by=officer.user_id,
        reviewed_at=datetime.now(timezone.utc),
        review_notes="Verified barcode against student database records.",
    )
    db_session.add(claim)
    db_session.commit()
    db_session.refresh(claim)

    # Record verified return handover
    return_record = Return(
        claim_id=claim.claim_id,
        recorded_by=officer.user_id,
        recipient_confirmation="Student presented university photo ID #98765 and signed pickup form.",
        condition_of_item="Intact with keys and lanyard",
        notes="Item successfully handed over.",
    )
    db_session.add(return_record)

    # Transition report lifecycle status to returned
    report.lifecycle_status = LifecycleStatus.RETURNED

    history = ReportStatusHistory(
        report_id=report.report_id,
        previous_lifecycle_status=LifecycleStatus.OPEN.value,
        new_lifecycle_status=LifecycleStatus.RETURNED.value,
        changed_by=officer.user_id,
        reason="Claim approved and item handed over to verified owner.",
    )
    db_session.add(history)
    db_session.commit()

    assert claim.return_record is not None
    assert claim.return_record.recorded_by == officer.user_id
    assert report.lifecycle_status == LifecycleStatus.RETURNED
    assert len(report.status_history) == 1


def test_notification_and_audit_log(db_session: Session):
    """Test Notification and AuditLog persistence."""
    user = User(full_name="Carlos", email="carlos@example.com", password_hash="h")
    db_session.add(user)
    db_session.commit()

    notif = Notification(
        user_id=user.user_id,
        title="Potential Match Found",
        message="A potential match for your lost report has been identified.",
        type=NotificationType.MATCH_FOUND,
        is_read=False,
    )
    audit = AuditLog(
        actor_user_id=user.user_id,
        action="AUTH_LOGIN_SUCCESS",
        entity_type="User",
        entity_id=str(user.user_id),
        summary='{"method": "password", "status": "success"}',
    )
    db_session.add_all([notif, audit])
    db_session.commit()

    assert notif.notification_id is not None
    assert audit.audit_id is not None
    assert audit.action == "AUTH_LOGIN_SUCCESS"
