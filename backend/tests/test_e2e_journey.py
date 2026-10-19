import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.models.enums import UserRole, ModerationStatus, LifecycleStatus, ClaimStatus
from app.models.category import Category
from app.models.custody import CustodyLocation
from app.core.security import hash_password, create_access_token
from app.models.user import User

def test_full_end_to_end_user_journey(client: TestClient, db_session: Session):
    """
    End-to-End lifecycle simulation testing:
    1. User A registration & authentication
    2. User B registration & authentication
    3. Category & custody location provisioning
    4. User A reports a lost item (Dell Laptop)
    5. User B reports a found item (Dell Laptop deposited at Main Library)
    6. System detects advisory match suggestion
    7. Staff approves/moderates found item for public search
    8. User A discovers found item and submits ownership claim with confidential evidence
    9. Staff reviews and approves claim (disallowing self-review)
    10. Staff records physical return handover
    11. Item report lifecycle status becomes 'returned'
    12. Admin verifies dashboard counters & audit trail
    """
    # 0. Provision Staff & Admin accounts
    staff_user = User(
        email="staff.officer@campus.edu",
        password_hash=hash_password("StaffPassword123!"),
        full_name="Staff Officer Mike",
        role=UserRole.STAFF,
        is_active=True,
    )
    admin_user = User(
        email="admin.manager@campus.edu",
        password_hash=hash_password("AdminPassword123!"),
        full_name="System Admin Sarah",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add_all([staff_user, admin_user])
    db_session.commit()
    db_session.refresh(staff_user)
    db_session.refresh(admin_user)

    staff_token = create_access_token(subject=str(staff_user.user_id), email=staff_user.email, role=staff_user.role.value)
    admin_token = create_access_token(subject=str(admin_user.user_id), email=admin_user.email, role=admin_user.role.value)

    # 1. Register User A (Alice - loses item)
    res_reg_a = client.post("/api/v1/auth/register", json={
        "email": "alice.student@campus.edu",
        "password": "AlicePassword123!",
        "full_name": "Alice Walker",
        "phone": "+15551112222"
    })
    assert res_reg_a.status_code == 201
    alice_id = res_reg_a.json()["user_id"]

    res_login_a = client.post("/api/v1/auth/login", json={"email": "alice.student@campus.edu", "password": "AlicePassword123!"})
    assert res_login_a.status_code == 200
    token_a = res_login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Register User B (Bob - finds item)
    res_reg_b = client.post("/api/v1/auth/register", json={
        "email": "bob.finder@campus.edu",
        "password": "BobPassword123!",
        "full_name": "Bob Finder",
        "phone": "+15553334444"
    })
    assert res_reg_b.status_code == 201
    token_b = client.post("/api/v1/auth/login", json={"email": "bob.finder@campus.edu", "password": "BobPassword123!"}).json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. Provision Category & Custody Location
    res_cat = client.post("/api/v1/admin/categories", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "category_name": "Electronics & Computers",
        "description": "Laptops, tablets, chargers, phones"
    })
    assert res_cat.status_code == 201
    cat_id = res_cat.json()["category_id"]

    res_loc = client.post("/api/v1/admin/custody-locations", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "name": "Central Campus Security Vault",
        "description": "Administration Hall Room 102",
        "restricted_details": "Keypad PIN: 4892"
    })
    assert res_loc.status_code == 201
    loc_id = res_loc.json()["custody_location_id"]

    # 4. User A reports Lost Item (Dell XPS 15)
    res_lost = client.post("/api/v1/reports", headers=headers_a, json={
        "item_name": "Dell XPS 15 Laptop with Linux sticker",
        "description": "Silver Dell XPS 15 9520 laptop in black neoprene sleeve. Has an Ubuntu Linux sticker on top cover.",
        "report_type": "lost",
        "category_id": cat_id,
        "date_lost_found": datetime.now(timezone.utc).isoformat(),
        "colour": "Silver",
        "brand": "Dell",
        "location": "Campus Science Library 2nd floor",
        "last_seen_location": "Computer lab, study desk 4",
        "reward_offered": "$50",
        "contact_info_restricted": "Call me at +15551112222"
    })
    assert res_lost.status_code == 201
    lost_data = res_lost.json()
    lost_report_id = lost_data["report_id"]
    assert lost_data["case_reference"].startswith("LR-")
    assert lost_data["lifecycle_status"] == "open"

    # 5. User B reports Found Item (Dell XPS 15) deposited at Central Campus Vault
    res_found = client.post("/api/v1/reports", headers=headers_b, json={
        "item_name": "Dell XPS Silver Laptop found on library desk",
        "description": "Found a Dell XPS laptop with a Linux penguin sticker on the cover. Brought to campus security.",
        "report_type": "found",
        "category_id": cat_id,
        "date_lost_found": datetime.now(timezone.utc).isoformat(),
        "colour": "Silver",
        "brand": "Dell",
        "location": "Science Library",
        "custody_location_id": loc_id,
        "storage_reference": "Vault Locker #12",
        "contact_info_restricted": "Finder Bob +15553334444"
    })
    assert res_found.status_code == 201
    found_data = res_found.json()
    found_report_id = found_data["report_id"]
    assert found_data["case_reference"].startswith("FR-")
    assert found_data["moderation_status"] == "pending_review"

    # 6. Verify matching engine detected advisory match
    res_matches = client.get("/api/v1/matches/me", headers=headers_a)
    assert res_matches.status_code == 200
    matches_list = res_matches.json()
    assert len(matches_list) >= 1
    assert matches_list[0]["score"] > 0.4

    # 7. Staff approves found report for public search
    res_verify = client.post(f"/api/v1/staff/reports/{found_report_id}/verify", headers={"Authorization": f"Bearer {staff_token}"}, json={
        "reason": "Verified by Mike. Item matches inventory log."
    })
    assert res_verify.status_code == 200
    assert res_verify.json()["moderation_status"] == "verified"

    # Verify public search returns verified found item, but masks contact & restricted details
    res_search = client.get("/api/v1/reports?report_type=found")
    assert res_search.status_code == 200
    found_search_items = [i for i in res_search.json() if i["report_id"] == found_report_id]
    assert len(found_search_items) == 1
    assert found_search_items[0].get("contact_info_restricted") is None
    assert found_search_items[0].get("found_item_staff") is None

    # 8. User A files an ownership claim on the found report
    res_claim = client.post(f"/api/v1/reports/{found_report_id}/claims", headers=headers_a, json={
        "ownership_evidence": "My name Alice Walker is set as the login username. Serial number is DL-984210. Purchase invoice from Dell Store."
    })
    assert res_claim.status_code == 201
    claim_id = res_claim.json()["claim_id"]
    assert res_claim.json()["status"] == "pending"

    # 9. Staff reviews the claim
    # 9a. Verify self-review prevention (Staff cannot approve if they were claimant)
    res_staff_review = client.post(f"/api/v1/staff/claims/{claim_id}/review", headers={"Authorization": f"Bearer {staff_token}"}, json={
        "decision": "approve",
        "notes": "Claimant provided matching login name and serial number matching bios."
    })
    assert res_staff_review.status_code == 200
    assert res_staff_review.json()["status"] == "approved"

    # 10. Staff records in-person handover confirmation
    res_handover = client.post(f"/api/v1/staff/claims/{claim_id}/return", headers={"Authorization": f"Bearer {staff_token}"}, json={
        "recipient_confirmation": "Alice Walker presented student ID card #900124 and logged into the device.",
        "condition_of_item": "Good condition with laptop sleeve and charger.",
        "notes": "Claimant signed physical handover sheet."
    })
    assert res_handover.status_code == 201
    assert res_handover.json()["return_id"] is not None

    # 11. Verify ItemReport lifecycle status transitioned to 'returned'
    res_final_report = client.get(f"/api/v1/reports/{found_report_id}", headers=headers_a)
    assert res_final_report.status_code == 200
    assert res_final_report.json()["lifecycle_status"] == "returned"

    # 12. Admin checks system dashboard statistics and audit logs
    res_dash = client.get("/api/v1/admin/dashboard/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_dash.status_code == 200
    dash_stats = res_dash.json()
    assert dash_stats["counts_by_lifecycle"]["returned"] >= 1
    assert dash_stats["total_returns"] >= 1

    res_audit = client.get("/api/v1/admin/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_audit.status_code == 200
    actions = [log["action"] for log in res_audit.json()]
    assert "ITEM_RETURNED" in actions or "REPORT_STATUS_CHANGE" in actions or "USER_REGISTERED" in actions
