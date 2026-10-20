from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.enums import LifecycleStatus, ModerationStatus, ReportType, UserRole
from app.models.user import User


@pytest.fixture
def test_users(db_session: Session):
    """Seed test users: regular user, another regular user, staff member, and admin."""
    user1 = User(
        full_name="Regular User One",
        email="user1@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.USER,
        is_active=True,
    )
    user2 = User(
        full_name="Regular User Two",
        email="user2@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.USER,
        is_active=True,
    )
    staff = User(
        full_name="Staff Officer",
        email="staff@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.STAFF,
        is_active=True,
    )
    admin = User(
        full_name="System Admin",
        email="admin@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add_all([user1, user2, staff, admin])
    db_session.commit()
    for u in [user1, user2, staff, admin]:
        db_session.refresh(u)
    return {"user1": user1, "user2": user2, "staff": staff, "admin": admin}


def get_token(client: TestClient, email: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return res.json()["access_token"]


def test_category_management(client: TestClient, test_users):
    """Test public category listing, admin creation, and duplicate rejection."""
    user_token = get_token(client, "user1@example.com")
    admin_token = get_token(client, "admin@example.com")

    # Regular user cannot create a category (403)
    res_forbidden = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"category_name": "Electronics"},
    )
    assert res_forbidden.status_code == 403

    # Admin creates category
    res_create = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "Electronics", "description": "Laptops and phones"},
    )
    assert res_create.status_code == 201
    cat_id = res_create.json()["category_id"]

    # Duplicate category creation fails (409)
    res_dup = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "electronics"},
    )
    assert res_dup.status_code == 409

    # Public listing returns created category
    res_pub = client.get("/api/v1/categories")
    assert res_pub.status_code == 200
    names = [c["category_name"] for c in res_pub.json()]
    assert "Electronics" in names

    # Admin deactivates category
    res_patch = client.patch(
        f"/api/v1/admin/categories/{cat_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["is_active"] is False

    # Inactive category is omitted from public listing
    res_pub2 = client.get("/api/v1/categories")
    assert "Electronics" not in [c["category_name"] for c in res_pub2.json()]


def test_custody_location_privacy(client: TestClient, test_users):
    """Test custody location creation and strict masking of restricted details from public view."""
    user_token = get_token(client, "user1@example.com")
    admin_token = get_token(client, "admin@example.com")

    # Regular user cannot create custody location
    assert client.post(
        "/api/v1/admin/custody-locations",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"name": "Vault A", "restricted_details": "Passcode 1234"},
    ).status_code == 403

    # Admin creates custody location
    res = client.post(
        "/api/v1/admin/custody-locations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Central Security Vault",
            "description": "Building A, Ground Floor",
            "restricted_details": "Room 102, Keybox #4 code 8899",
        },
    )
    assert res.status_code == 201
    assert res.json()["restricted_details"] == "Room 102, Keybox #4 code 8899"

    # Public endpoint strictly excludes restricted_details
    pub_res = client.get("/api/v1/custody-locations")
    assert pub_res.status_code == 200
    locs = pub_res.json()
    assert len(locs) > 0
    assert "Central Security Vault" in [l["name"] for l in locs]
    for loc in locs:
        assert "restricted_details" not in loc


def test_create_lost_and_found_reports(client: TestClient, test_users):
    """Test creating lost and found reports with validation, unique case references, and subtypes."""
    admin_token = get_token(client, "admin@example.com")
    user_token = get_token(client, "user1@example.com")

    # 1. Setup active category & custody location
    cat_resp = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "Personal Gadgets"},
    )
    category_id = cat_resp.json()["category_id"]

    custody_resp = client.post(
        "/api/v1/admin/custody-locations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Campus Desk", "restricted_details": "Drawer 2B"},
    )
    custody_id = custody_resp.json()["custody_location_id"]

    # 2. User creates Lost Report
    lost_payload = {
        "report_type": "lost",
        "category_id": category_id,
        "item_name": "Sony Headphones",
        "description": "Black over-ear wireless headphones with small scratch",
        "date_lost_found": datetime.now(timezone.utc).isoformat(),
        "location": "Science Block 3rd floor lab",
        "colour": "Black",
        "brand": "Sony",
        "contact_preference": "email",
        "contact_info_restricted": "owner.private@example.com",
        "last_seen_location": "Lab bench 4",
        "reward_offered": "$20",
    }
    lost_res = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {user_token}"},
        json=lost_payload,
    )
    assert lost_res.status_code == 201
    lost_data = lost_res.json()
    assert lost_data["case_reference"].startswith("LR-")
    assert lost_data["report_type"] == "lost"
    assert lost_data["moderation_status"] == "pending_review"
    assert lost_data["lifecycle_status"] == "open"
    assert lost_data["lost_item"]["last_seen_location"] == "Lab bench 4"
    assert lost_data["lost_item"]["reward_offered"] == "$20"

    # 3. User creates Found Report
    found_payload = {
        "report_type": "found",
        "category_id": category_id,
        "item_name": "Black Wireless Headphones",
        "description": "Found near computer terminals",
        "date_lost_found": datetime.now(timezone.utc).isoformat(),
        "location": "Science Block",
        "colour": "Black",
        "custody_location_id": custody_id,
        "storage_reference": "BIN-A1",
    }
    found_res = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {user_token}"},
        json=found_payload,
    )
    assert found_res.status_code == 201
    found_data = found_res.json()
    assert found_data["case_reference"].startswith("FR-")
    assert found_data["report_type"] == "found"
    assert found_data["found_item"]["custody_location_id"] == custody_id
    assert found_data["found_item"]["custody_location_name"] == "Campus Desk"


def test_privacy_boundaries_and_moderation(client: TestClient, test_users):
    """Test that unverified reports and restricted contact/custody fields are protected from visitors."""
    admin_token = get_token(client, "admin@example.com")
    user1_token = get_token(client, "user1@example.com")
    user2_token = get_token(client, "user2@example.com")
    staff_token = get_token(client, "staff@example.com")

    cat_id = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "Jewelry"},
    ).json()["category_id"]

    custody_id = client.post(
        "/api/v1/admin/custody-locations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Jewelry Safe", "restricted_details": "Safe combo 7788"},
    ).json()["custody_location_id"]

    # User 1 creates found report with restricted contact and storage reference
    report_res = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {user1_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Gold Ring with Diamond",
            "description": "Found in restroom sink area",
            "date_lost_found": datetime.now(timezone.utc).isoformat(),
            "location": "Student Hall",
            "contact_info_restricted": "Finder phone: 555-9988",
            "custody_location_id": custody_id,
            "storage_reference": "SAFE-007",
        },
    )
    report_id = report_res.json()["report_id"]

    # 1. Unverified report is NOT visible to public visitors
    pub_list = client.get("/api/v1/reports").json()
    assert report_id not in [r["report_id"] for r in pub_list]

    # 2. Staff views pending list and verifies report
    pending = client.get("/api/v1/staff/reports/pending", headers={"Authorization": f"Bearer {staff_token}"})
    assert pending.status_code == 200
    assert report_id in [r["report_id"] for r in pending.json()]

    verify_res = client.post(
        f"/api/v1/staff/reports/{report_id}/verify",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"reason": "Verified genuine item with staff custody receipt."},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["moderation_status"] == "verified"

    # 3. Verified report is now in public list, BUT privacy fields are hidden
    pub_detail = client.get(f"/api/v1/reports/{report_id}").json()
    assert "contact_info_restricted" not in pub_detail
    assert "found_item_staff" not in pub_detail
    assert pub_detail["found_item"]["custody_location_name"] == "Jewelry Safe"
    assert "Safe combo" not in str(pub_detail)

    # 4. Another regular user (User 2) cannot see restricted details
    user2_detail = client.get(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {user2_token}"},
    ).json()
    assert "contact_info_restricted" not in user2_detail
    assert "found_item_staff" not in user2_detail

    # 5. Creator (User 1) sees their own restricted contact info
    owner_detail = client.get(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {user1_token}"},
    ).json()
    assert owner_detail["contact_info_restricted"] == "Finder phone: 555-9988"

    # 6. Staff sees restricted storage details
    staff_detail = client.get(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {staff_token}"},
    ).json()
    assert staff_detail["found_item_staff"]["storage_reference"] == "SAFE-007"
    assert staff_detail["found_item_staff"]["restricted_custody_details"] == "Safe combo 7788"


def test_edit_and_close_permissions(client: TestClient, test_users):
    """Test that users can only edit/close their own reports while open, and audit history is recorded."""
    admin_token = get_token(client, "admin@example.com")
    user1_token = get_token(client, "user1@example.com")
    user2_token = get_token(client, "user2@example.com")

    cat_id = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "Books"},
    ).json()["category_id"]

    report_id = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {user1_token}"},
        json={
            "report_type": "lost",
            "category_id": cat_id,
            "item_name": "Physics Textbook",
            "description": "Halliday Resnick 10th edition",
            "date_lost_found": datetime.now(timezone.utc).isoformat(),
            "location": "Physics Department",
        },
    ).json()["report_id"]

    # User 2 attempts to edit User 1's report -> 403 Forbidden
    res_edit_forbidden = client.patch(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {user2_token}"},
        json={"item_name": "Hacked Title"},
    )
    assert res_edit_forbidden.status_code == 403

    # User 1 successfully edits own report
    res_edit_ok = client.patch(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {user1_token}"},
        json={"item_name": "Physics Textbook with Notes", "colour": "Blue cover"},
    )
    assert res_edit_ok.status_code == 200
    assert res_edit_ok.json()["item_name"] == "Physics Textbook with Notes"
    assert res_edit_ok.json()["colour"] == "Blue cover"

    # User 2 attempts to close User 1's report -> 403 Forbidden
    assert client.post(
        f"/api/v1/reports/{report_id}/close",
        headers={"Authorization": f"Bearer {user2_token}"},
    ).status_code == 403

    # User 1 closes own report -> becomes archived
    res_close = client.post(
        f"/api/v1/reports/{report_id}/close?reason=Found+at+home",
        headers={"Authorization": f"Bearer {user1_token}"},
    )
    assert res_close.status_code == 200
    assert res_close.json()["lifecycle_status"] == "archived"

    # User 1 attempts to edit archived report -> 400 Bad Request
    res_edit_closed = client.patch(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {user1_token}"},
        json={"item_name": "Should not allow edit"},
    )
    assert res_edit_closed.status_code == 400

    # History contains transitions
    history_res = client.get(
        f"/api/v1/reports/{report_id}/history",
        headers={"Authorization": f"Bearer {user1_token}"},
    )
    assert history_res.status_code == 200
    statuses = [h["new_lifecycle_status"] for h in history_res.json()]
    assert "open" in statuses
    assert "archived" in statuses


def test_invalid_status_transition_returned(client: TestClient, test_users):
    """Test invariant: transitioning lifecycle directly to 'returned' requires approved claim + handover."""
    admin_token = get_token(client, "admin@example.com")
    staff_token = get_token(client, "staff@example.com")
    user1_token = get_token(client, "user1@example.com")

    cat_id = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "Umbrellas"},
    ).json()["category_id"]

    report_id = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {user1_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Black Umbrella",
            "description": "Left on bench",
            "date_lost_found": datetime.now(timezone.utc).isoformat(),
            "location": "Main Gate",
        },
    ).json()["report_id"]

    # Staff attempts to set lifecycle_status to 'returned' directly via /status -> 400 Bad Request
    res_bad = client.patch(
        f"/api/v1/staff/reports/{report_id}/status",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"lifecycle_status": "returned", "reason": "Attempting direct return"},
    )
    assert res_bad.status_code == 400
    assert "without an approved claim" in res_bad.json()["detail"]


def test_delete_report(client: TestClient, test_users):
    """Test deleting a report from database: user is forbidden, staff/admin can delete."""
    user1_token = get_token(client, "user1@example.com")
    staff_token = get_token(client, "staff@example.com")
    admin_token = get_token(client, "admin@example.com")

    cat_id = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "Temporary Test Items"},
    ).json()["category_id"]

    report_id = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {user1_token}"},
        json={
            "report_type": "lost",
            "category_id": cat_id,
            "item_name": "Temporary Notebook",
            "description": "Notebook for testing deletion",
            "date_lost_found": datetime.now(timezone.utc).isoformat(),
            "location": "Library 2nd Floor",
        },
    ).json()["report_id"]

    # Regular user cannot delete
    res_user_delete = client.delete(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {user1_token}"},
    )
    assert res_user_delete.status_code == 403

    # Staff or Admin can delete
    res_delete = client.delete(
        f"/api/v1/reports/{report_id}?reason=Removed+test+data",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_delete.status_code == 200
    assert "permanently removed" in res_delete.json()["message"]

    # Verify report is gone
    res_get = client.get(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_get.status_code == 404

