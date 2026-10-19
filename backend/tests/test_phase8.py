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
def phase8_data(db_session: Session):
    """Seed data for Phase 8 admin tests."""
    cat = Category(category_name="Stationery & Notebooks", is_active=True)
    db_session.add(cat)
    db_session.flush()

    custody = CustodyLocation(
        name="Admin Central Safe",
        description="Head Office Room 101",
        restricted_details="Code 7788",
        is_active=True,
    )
    db_session.add(custody)
    db_session.flush()

    pwd_hash = hash_password("Password123!")

    admin = User(
        email="admin.phase8@example.com",
        password_hash=pwd_hash,
        full_name="Phase 8 Master Admin",
        role=UserRole.ADMIN,
        is_active=True,
    )
    staff = User(
        email="staff.phase8@example.com",
        password_hash=pwd_hash,
        full_name="Phase 8 Staff",
        role=UserRole.STAFF,
        is_active=True,
    )
    user_alice = User(
        email="alice.phase8@example.com",
        password_hash=pwd_hash,
        full_name="Alice User",
        role=UserRole.USER,
        is_active=True,
    )
    user_bob = User(
        email="bob.phase8@example.com",
        password_hash=pwd_hash,
        full_name="Bob User",
        role=UserRole.USER,
        is_active=True,
    )

    db_session.add_all([admin, staff, user_alice, user_bob])
    db_session.flush()
    db_session.add(StaffProfile(user_id=staff.user_id, department="Lost & Found Desk"))
    db_session.commit()

    return {
        "category_id": cat.category_id,
        "custody_id": custody.custody_location_id,
        "admin": admin,
        "staff": staff,
        "alice": user_alice,
        "bob": user_bob,
    }


def get_token(client: TestClient, email: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return res.json()["access_token"]


def test_dashboard_stats_counting_rules(client: TestClient, phase8_data):
    """Test dashboard metrics calculation and exact counts across lifecycle statuses (FR-23)."""
    admin_token = get_token(client, "admin.phase8@example.com")
    alice_token = get_token(client, "alice.phase8@example.com")
    bob_token = get_token(client, "bob.phase8@example.com")
    staff_token = get_token(client, "staff.phase8@example.com")

    # Regular user receives 403 on admin dashboard
    forbidden = client.get("/api/v1/admin/dashboard/stats", headers={"Authorization": f"Bearer {alice_token}"})
    assert forbidden.status_code == 403

    cat_id = phase8_data["category_id"]
    cust_id = phase8_data["custody_id"]
    now = datetime.now(timezone.utc).isoformat()

    # 1. Create a LOST report (Open)
    rep_lost = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "lost",
            "category_id": cat_id,
            "item_name": "Maths Notebook",
            "description": "Grid ruled blue cover notebook",
            "date_lost_found": now,
            "location": "Maths Dept",
        },
    ).json()

    # 2. Create a FOUND report to return (transitions from Open -> Claimed -> Returned)
    rep_found = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Scientific Pen Set",
            "description": "Fountain pens in leather sleeve",
            "date_lost_found": now,
            "location": "Study Hall",
            "found_location": "Desk 4",
            "custody_location_id": cust_id,
        },
    ).json()

    # Staff verifies found report
    client.post(
        f"/api/v1/staff/reports/{rep_found['report_id']}/verify",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"reason": "Verified in custody"},
    )

    # Bob files claim -> report becomes CLAIMED
    claim = client.post(
        f"/api/v1/reports/{rep_found['report_id']}/claims",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={"ownership_evidence": "Pens have initials B.U. engraved on barrel"},
    ).json()

    # Staff approves claim
    client.post(
        f"/api/v1/staff/claims/{claim['claim_id']}/review",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"decision": "approve", "notes": "Initials verified"},
    )

    # Staff completes handover -> report becomes RETURNED
    client.post(
        f"/api/v1/staff/claims/{claim['claim_id']}/return",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"recipient_confirmation": "Student ID #776655 inspected"},
    )

    # 3. Create another found report and dispose it
    rep_dispose = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Broken Pencil Case",
            "description": "Torn fabric case with unusable scrap",
            "date_lost_found": now,
            "location": "Lobby",
            "found_location": "Trash area",
            "custody_location_id": cust_id,
        },
    ).json()

    client.post(
        f"/api/v1/staff/reports/{rep_dispose['report_id']}/dispose",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"reason": "Unusable scrap disposed under waste policy", "confirm": True},
    )

    # 4. Fetch dashboard stats
    stats_res = client.get(
        "/api/v1/admin/dashboard/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert stats_res.status_code == 200
    stats = stats_res.json()

    assert stats["total_reports"] >= 3
    assert stats["total_lost_reports"] >= 1
    assert stats["total_found_reports"] >= 2
    assert stats["counts_by_lifecycle"]["open"] >= 1
    assert stats["counts_by_lifecycle"]["returned"] >= 1
    assert stats["counts_by_lifecycle"]["disposed"] >= 1
    assert stats["total_claims"] >= 1
    assert stats["total_returns"] >= 1
    assert stats["total_users"] >= 4
    assert stats["total_staff"] >= 2


def test_admin_user_role_management_and_lockout_prevention(client: TestClient, phase8_data):
    """Test user directory listing, role promotion, and lockout prevention invariants."""
    admin_token = get_token(client, "admin.phase8@example.com")
    alice_id = phase8_data["alice"].user_id
    admin_id = phase8_data["admin"].user_id

    # 1. Admin lists users
    users_res = client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert users_res.status_code == 200
    assert len(users_res.json()) >= 4

    # 2. Admin promotes Alice to STAFF with department
    promote_res = client.patch(
        f"/api/v1/admin/users/{alice_id}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "role": "staff",
            "department": "Campus Security North",
            "employee_code": "SEC-009",
        },
    )
    assert promote_res.status_code == 200
    alice_data = promote_res.json()
    assert alice_data["role"] == "staff"
    assert alice_data["staff_profile"]["department"] == "Campus Security North"
    assert alice_data["staff_profile"]["employee_code"] == "SEC-009"

    # 3. Lockout prevention: Admin tries to demote their own account to 'user' -> 400 Bad Request
    self_demote = client.patch(
        f"/api/v1/admin/users/{admin_id}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "user"},
    )
    assert self_demote.status_code == 400
    assert "prevent system lockout" in self_demote.json()["detail"]

    # 4. Lockout prevention: Admin tries to deactivate their own account -> 400 Bad Request
    self_deactivate = client.patch(
        f"/api/v1/admin/users/{admin_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False, "reason": "Accidental self-deactivation"},
    )
    assert self_deactivate.status_code == 400
    assert "cannot deactivate their own account" in self_deactivate.json()["detail"]

    # 5. Admin suspends Bob's account
    bob_id = phase8_data["bob"].user_id
    suspend_res = client.patch(
        f"/api/v1/admin/users/{bob_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False, "reason": "Suspicious fraudulent claim activity"},
    )
    assert suspend_res.status_code == 200
    assert suspend_res.json()["is_active"] is False

    # Suspended user cannot log in -> 403 Forbidden
    login_attempt = client.post(
        "/api/v1/auth/login",
        json={"email": "bob.phase8@example.com", "password": "Password123!"},
    )
    assert login_attempt.status_code == 403
    assert "inactive" in login_attempt.json()["detail"].lower()
