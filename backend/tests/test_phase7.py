from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.category import Category
from app.models.custody import CustodyLocation
from app.models.enums import UserRole
from app.models.user import StaffProfile, User


@pytest.fixture
def phase7_data(db_session: Session):
    """Seed categories, custody locations, and users for Phase 7 handover tests."""
    cat = Category(category_name="Valuables & Jewellery", is_active=True)
    db_session.add(cat)
    db_session.flush()

    custody1 = CustodyLocation(
        name="Security Vault Main",
        description="Ground floor central security safe",
        restricted_details="Vault Code: 4499",
        is_active=True,
    )
    custody2 = CustodyLocation(
        name="Campus West Storage Locker",
        description="West Wing Locker #12",
        restricted_details="Locker Key #12",
        is_active=True,
    )
    db_session.add_all([custody1, custody2])
    db_session.flush()

    pwd_hash = hash_password("Password123!")

    admin = User(
        email="admin.phase7@example.com",
        password_hash=pwd_hash,
        full_name="Phase 7 Admin",
        role=UserRole.ADMIN,
        is_active=True,
    )
    staff = User(
        email="staff.phase7@example.com",
        password_hash=pwd_hash,
        full_name="Phase 7 Staff Officer",
        role=UserRole.STAFF,
        is_active=True,
    )
    alice = User(
        email="alice.phase7@example.com",
        password_hash=pwd_hash,
        full_name="Alice Finder",
        role=UserRole.USER,
        is_active=True,
    )
    bob = User(
        email="bob.phase7@example.com",
        password_hash=pwd_hash,
        full_name="Bob Rightful Owner",
        role=UserRole.USER,
        is_active=True,
    )
    charlie = User(
        email="charlie.phase7@example.com",
        password_hash=pwd_hash,
        full_name="Charlie Bystander",
        role=UserRole.USER,
        is_active=True,
    )

    db_session.add_all([admin, staff, alice, bob, charlie])
    db_session.flush()
    db_session.add(StaffProfile(user_id=staff.user_id, department="Campus Security"))
    db_session.commit()

    return {
        "category_id": cat.category_id,
        "custody1_id": custody1.custody_location_id,
        "custody2_id": custody2.custody_location_id,
        "admin": admin,
        "staff": staff,
        "alice": alice,
        "bob": bob,
        "charlie": charlie,
    }


def get_token(client: TestClient, email: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return res.json()["access_token"]


def test_handover_success_and_lifecycle_invariants(client: TestClient, phase7_data):
    """Test full return lifecycle: claim approval required, handover persistence, status update to RETURNED."""
    alice_token = get_token(client, "alice.phase7@example.com")
    bob_token = get_token(client, "bob.phase7@example.com")
    staff_token = get_token(client, "staff.phase7@example.com")

    cat_id = phase7_data["category_id"]
    cust1_id = phase7_data["custody1_id"]
    now = datetime.now(timezone.utc).isoformat()

    # 1. Alice files a found report
    rep = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Gold Ring with Sapphire",
            "description": "Found ring in central courtyard bench",
            "date_lost_found": now,
            "location": "Central Courtyard",
            "found_location": "Under wooden bench #3",
            "custody_location_id": cust1_id,
        },
    ).json()
    rep_id = rep["report_id"]

    # Staff verifies the report
    client.post(
        f"/api/v1/staff/reports/{rep_id}/verify",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"reason": "Verified and securely vaulted"},
    )

    # 2. Bob submits ownership claim
    claim = client.post(
        f"/api/v1/reports/{rep_id}/claims",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={"ownership_evidence": "Engraved inside band: 'Forever & Always 2022'"},
    ).json()
    claim_id = claim["claim_id"]

    # Invariant: Staff tries to record return while claim is still PENDING -> 400 Bad Request
    early_return = client.post(
        f"/api/v1/staff/claims/{claim_id}/return",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"recipient_confirmation": "Student ID #12345"},
    )
    assert early_return.status_code == 400
    assert "claim is in status 'pending', expected 'approved'" in early_return.json()["detail"]

    # 3. Staff approves claim
    client.post(
        f"/api/v1/staff/claims/{claim_id}/review",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"decision": "approve", "notes": "Engraving verified against inspection record"},
    )

    # 4. Staff records handover confirmation
    return_res = client.post(
        f"/api/v1/staff/claims/{claim_id}/return",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={
            "recipient_confirmation": "Inspected National ID: 987654321A, verified physical signature",
            "condition_of_item": "Pristine, no damage",
            "notes": "Claimant collected item in person at security desk",
        },
    )
    assert return_res.status_code == 201
    return_data = return_res.json()
    assert return_data["claim_id"] == claim_id
    assert return_data["report_id"] == rep_id
    assert return_data["officer_name"] == "Phase 7 Staff Officer"
    assert "987654321A" in return_data["recipient_confirmation"]

    # 5. Invariant check: report lifecycle is now RETURNED
    rep_check = client.get(
        f"/api/v1/reports/{rep_id}",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert rep_check.json()["lifecycle_status"] == "returned"

    # Invariant check: cannot record second return for same claim -> 400 Bad Request
    dup_return = client.post(
        f"/api/v1/staff/claims/{claim_id}/return",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"recipient_confirmation": "Duplicate attempt"},
    )
    assert dup_return.status_code == 400
    assert "already been recorded" in dup_return.json()["detail"]

    # 6. Verify notifications dispatched to both Bob (claimant) and Alice (finder)
    bob_notifs = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {bob_token}"})
    assert any("Item Handover Completed" in n["title"] for n in bob_notifs.json())

    alice_notifs = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {alice_token}"})
    assert any("Found Item Returned to Owner" in n["title"] for n in alice_notifs.json())


def test_handover_privacy_access(client: TestClient, phase7_data):
    """Test access control for return confirmation record: claimant & staff only."""
    alice_token = get_token(client, "alice.phase7@example.com")
    bob_token = get_token(client, "bob.phase7@example.com")
    charlie_token = get_token(client, "charlie.phase7@example.com")
    staff_token = get_token(client, "staff.phase7@example.com")

    cat_id = phase7_data["category_id"]
    cust1_id = phase7_data["custody1_id"]
    now = datetime.now(timezone.utc).isoformat()

    # Create found report, claim it, approve it, and return it
    rep = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Leather Handbag",
            "description": "Black handbag with gold buckle",
            "date_lost_found": now,
            "location": "North Cafeteria",
            "found_location": "Table 18",
            "custody_location_id": cust1_id,
        },
    ).json()

    claim = client.post(
        f"/api/v1/reports/{rep['report_id']}/claims",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={"ownership_evidence": "Contains library card #54321 with name Bob"},
    ).json()
    claim_id = claim["claim_id"]

    client.post(
        f"/api/v1/staff/claims/{claim_id}/review",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"decision": "approve", "notes": "Approved for privacy test"},
    )

    client.post(
        f"/api/v1/staff/claims/{claim_id}/return",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"recipient_confirmation": "Inspected Driver License #DL-908123"},
    )

    # 1. Claimant Bob can view handover details
    bob_view = client.get(
        f"/api/v1/claims/{claim_id}/return",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert bob_view.status_code == 200
    assert "Inspected Driver License #DL-908123" in bob_view.json()["recipient_confirmation"]

    # 2. Staff can view handover details
    staff_view = client.get(
        f"/api/v1/claims/{claim_id}/return",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert staff_view.status_code == 200

    # 3. Bystander Charlie cannot view handover details -> 403 Forbidden
    charlie_view = client.get(
        f"/api/v1/claims/{claim_id}/return",
        headers={"Authorization": f"Bearer {charlie_token}"},
    )
    assert charlie_view.status_code == 403


def test_custody_transfer_and_storage_update(client: TestClient, phase7_data):
    """Test transferring item custody location and updating storage reference."""
    alice_token = get_token(client, "alice.phase7@example.com")
    staff_token = get_token(client, "staff.phase7@example.com")

    cat_id = phase7_data["category_id"]
    cust1_id = phase7_data["custody1_id"]
    cust2_id = phase7_data["custody2_id"]
    now = datetime.now(timezone.utc).isoformat()

    # Create new found item
    rep = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Calculator TI-84",
            "description": "Graphing calculator in room 101",
            "date_lost_found": now,
            "location": "Math Building",
            "found_location": "Desk 12",
            "custody_location_id": cust1_id,
        },
    ).json()
    rep_id = rep["report_id"]

    # Staff transfers custody to Custody 2 (Campus West Locker)
    transfer_res = client.post(
        f"/api/v1/staff/reports/{rep_id}/custody-transfer",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={
            "new_custody_location_id": cust2_id,
            "storage_reference": "West-Bin-44",
            "reason": "Moved to West wing for student pickup ease",
        },
    )
    assert transfer_res.status_code == 200
    updated_rep = transfer_res.json()
    assert updated_rep["found_item_staff"]["custody_location_id"] == cust2_id
    assert updated_rep["found_item_staff"]["storage_reference"] == "West-Bin-44"


def test_policy_controlled_archive_and_disposal(client: TestClient, phase7_data):
    """Test policy-controlled archiving and disposal with required explicit confirmation."""
    alice_token = get_token(client, "alice.phase7@example.com")
    staff_token = get_token(client, "staff.phase7@example.com")

    cat_id = phase7_data["category_id"]
    cust1_id = phase7_data["custody1_id"]
    now = datetime.now(timezone.utc).isoformat()

    # 1. Report to archive
    rep_archive = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "lost",
            "category_id": cat_id,
            "item_name": "Lost Umbrella",
            "description": "Black umbrella left on bus",
            "date_lost_found": now,
            "location": "Bus Stop 5",
        },
    ).json()

    # Archiving without confirm=true fails -> 400 Bad Request
    fail_archive = client.post(
        f"/api/v1/staff/reports/{rep_archive['report_id']}/archive",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"reason": "Expired report", "confirm": False},
    )
    assert fail_archive.status_code == 400
    assert "Explicit confirmation" in fail_archive.json()["detail"]

    # Archiving with confirm=true succeeds
    ok_archive = client.post(
        f"/api/v1/staff/reports/{rep_archive['report_id']}/archive",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"reason": "Report expired beyond 90 days retention policy", "confirm": True},
    )
    assert ok_archive.status_code == 200
    assert ok_archive.json()["lifecycle_status"] == "archived"

    # 2. Found item to dispose
    rep_dispose = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Perishable Lunchbox",
            "description": "Contains spoiled food items",
            "date_lost_found": now,
            "location": "Cafeteria",
            "found_location": "Under table 4",
            "custody_location_id": cust1_id,
        },
    ).json()

    # Disposal with confirm=true succeeds
    ok_dispose = client.post(
        f"/api/v1/staff/reports/{rep_dispose['report_id']}/dispose",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"reason": "Perishable contents decomposed beyond safe storage", "confirm": True},
    )
    assert ok_dispose.status_code == 200
    assert ok_dispose.json()["lifecycle_status"] == "disposed"


def test_admin_audit_log_inspection(client: TestClient, phase7_data):
    """Test admin inspection of system audit logs (FR-24 compliance)."""
    admin_token = get_token(client, "admin.phase7@example.com")
    bob_token = get_token(client, "bob.phase7@example.com")

    # Regular user receives 403 Forbidden
    user_forbidden = client.get(
        "/api/v1/admin/audit-logs",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert user_forbidden.status_code == 403

    # Administrator can view audit logs
    admin_view = client.get(
        "/api/v1/admin/audit-logs",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_view.status_code == 200
    logs = admin_view.json()
    assert len(logs) > 0
    # Audit log contains required fields
    sample_log = logs[0]
    assert "action" in sample_log
    assert "entity_type" in sample_log
    assert "summary" in sample_log
    assert "timestamp" in sample_log
