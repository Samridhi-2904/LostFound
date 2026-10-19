from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.category import Category
from app.models.custody import CustodyLocation
from app.models.enums import ClaimStatus, LifecycleStatus, ModerationStatus, UserRole
from app.models.user import StaffProfile, User


@pytest.fixture
def claims_fixture_data(db_session: Session):
    """Seed categories, custody locations, and users for Phase 6 claim tests."""
    cat = Category(category_name="Electronics & Laptops", is_active=True)
    db_session.add(cat)
    db_session.flush()

    custody = CustodyLocation(
        name="Main Campus Security Locker Room",
        description="Ground floor administration desk",
        restricted_details="Master Key Box #4, Code 9821",
        is_active=True,
    )
    db_session.add(custody)
    db_session.flush()

    pwd_hash = hash_password("TestSecurePassword123!")

    # Admin
    admin_user = User(
        email="admin.claims@example.com",
        password_hash=pwd_hash,
        full_name="Admin Claims Officer",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin_user)

    # Staff 1
    staff_1 = User(
        email="staff1.claims@example.com",
        password_hash=pwd_hash,
        full_name="Staff Reviewer One",
        role=UserRole.STAFF,
        is_active=True,
    )
    db_session.add(staff_1)
    db_session.flush()
    db_session.add(StaffProfile(user_id=staff_1.user_id, department="Security Desk"))

    # Staff 2
    staff_2 = User(
        email="staff2.claims@example.com",
        password_hash=pwd_hash,
        full_name="Staff Reviewer Two",
        role=UserRole.STAFF,
        is_active=True,
    )
    db_session.add(staff_2)
    db_session.flush()
    db_session.add(StaffProfile(user_id=staff_2.user_id, department="Lost & Found Office"))

    # Alice (Finder)
    alice = User(
        email="alice.finder@example.com",
        password_hash=pwd_hash,
        full_name="Alice Finder",
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(alice)

    # Bob (Legitimate Claimant)
    bob = User(
        email="bob.owner@example.com",
        password_hash=pwd_hash,
        full_name="Bob Real Owner",
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(bob)

    # Charlie (Third party / bystander)
    charlie = User(
        email="charlie.other@example.com",
        password_hash=pwd_hash,
        full_name="Charlie Other",
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(charlie)

    db_session.commit()

    return {
        "category_id": cat.category_id,
        "custody_id": custody.custody_location_id,
        "admin": admin_user,
        "staff1": staff_1,
        "staff2": staff_2,
        "alice": alice,
        "bob": bob,
        "charlie": charlie,
    }


def get_token(client: TestClient, email: str, password: str = "TestSecurePassword123!") -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return res.json()["access_token"]


def test_submit_claim_on_found_report(client: TestClient, claims_fixture_data):
    """Test standard claim submission against an eligible found report."""
    alice_token = get_token(client, "alice.finder@example.com")
    bob_token = get_token(client, "bob.owner@example.com")
    staff_token = get_token(client, "staff1.claims@example.com")

    cat_id = claims_fixture_data["category_id"]
    cust_id = claims_fixture_data["custody_id"]

    # 1. Alice creates a FOUND report
    now = datetime.now(timezone.utc).isoformat()
    rep_res = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "MacBook Pro 14 M2",
            "description": "Found space grey laptop on level 2 desk",
            "date_lost_found": now,
            "location": "Science Library Floor 2",
            "found_location": "Science Library Desk 14",
            "custody_location_id": cust_id,
        },
    )
    assert rep_res.status_code == 201
    rep_id = rep_res.json()["report_id"]

    # Staff verifies the report
    client.post(
        f"/api/v1/staff/reports/{rep_id}/verify",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"reason": "Verified and logged in custody"},
    )

    # 2. Bob submits a claim with private ownership evidence
    claim_res = client.post(
        f"/api/v1/reports/{rep_id}/claims",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={
            "ownership_evidence": "Serial number is C02G1234MD6R. Has an Apple sticker on bottom left corner and scratch near HDMI port.",
        },
    )
    assert claim_res.status_code == 201
    claim_data = claim_res.json()
    assert claim_data["report_id"] == rep_id
    assert claim_data["status"] == "pending"
    assert "Serial number is C02G1234MD6R" in claim_data["ownership_evidence"]
    assert claim_data["claimant_name"] == "Bob Real Owner"
    claim_id = claim_data["claim_id"]

    # 3. Verify report lifecycle status transitioned to CLAIMED
    rep_check = client.get(
        f"/api/v1/reports/{rep_id}",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert rep_check.json()["lifecycle_status"] == "claimed"

    # 4. Verify notifications dispatched to both Bob (claimant) and Alice (finder)
    bob_notifs = client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert any("Claim Submitted" in n["title"] for n in bob_notifs.json())

    alice_notifs = client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert any("Claim Filed on Found Item" in n["title"] for n in alice_notifs.json())


def test_claim_invariants_and_error_handling(client: TestClient, claims_fixture_data):
    """Test claim invariant enforcement: cannot claim lost reports, own found items, or submit duplicate active claims."""
    alice_token = get_token(client, "alice.finder@example.com")
    bob_token = get_token(client, "bob.owner@example.com")
    charlie_token = get_token(client, "charlie.other@example.com")

    cat_id = claims_fixture_data["category_id"]
    cust_id = claims_fixture_data["custody_id"]
    now = datetime.now(timezone.utc).isoformat()

    # 1. Create a LOST report by Charlie
    lost_rep = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {charlie_token}"},
        json={
            "report_type": "lost",
            "category_id": cat_id,
            "item_name": "Lost Wallet",
            "description": "Black wallet lost near cafeteria",
            "date_lost_found": now,
            "location": "Cafeteria",
        },
    ).json()

    # Bob tries to claim the LOST report -> 400 Bad Request
    claim_lost = client.post(
        f"/api/v1/reports/{lost_rep['report_id']}/claims",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={"ownership_evidence": "This is my lost wallet please give it back"},
    )
    assert claim_lost.status_code == 400
    assert "found item reports" in claim_lost.json()["detail"]

    # 2. Create a FOUND report by Alice
    found_rep = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Silver Watch",
            "description": "Found analog watch",
            "date_lost_found": now,
            "location": "Sports Hall",
            "found_location": "Gym Bench 3",
            "custody_location_id": cust_id,
        },
    ).json()

    # Alice (Finder) tries to claim her own found report -> 400 Bad Request
    claim_own = client.post(
        f"/api/v1/reports/{found_rep['report_id']}/claims",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={"ownership_evidence": "I found it but I also own it"},
    )
    assert claim_own.status_code == 400
    assert "cannot submit an ownership claim for an item you reported as found" in claim_own.json()["detail"]

    # 3. Bob submits a valid claim
    claim_1 = client.post(
        f"/api/v1/reports/{found_rep['report_id']}/claims",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={"ownership_evidence": "Engraved with initials B.O. on back plate"},
    )
    assert claim_1.status_code == 201

    # Bob tries to submit a second active claim on the same report -> 400 Duplicate prevention
    claim_duplicate = client.post(
        f"/api/v1/reports/{found_rep['report_id']}/claims",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={"ownership_evidence": "Another claim from me for the same watch"},
    )
    assert claim_duplicate.status_code == 400
    assert "already have an active claim" in claim_duplicate.json()["detail"]


def test_ownership_evidence_privacy_boundaries(client: TestClient, claims_fixture_data):
    """Test that claimant evidence is strictly confidential and inaccessible to arbitrary users."""
    alice_token = get_token(client, "alice.finder@example.com")
    bob_token = get_token(client, "bob.owner@example.com")
    charlie_token = get_token(client, "charlie.other@example.com")
    staff_token = get_token(client, "staff1.claims@example.com")

    cat_id = claims_fixture_data["category_id"]
    cust_id = claims_fixture_data["custody_id"]
    now = datetime.now(timezone.utc).isoformat()

    found_rep = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Leather Purse",
            "description": "Brown purse with cards inside",
            "date_lost_found": now,
            "location": "Auditorium",
            "found_location": "Row G Seat 12",
            "custody_location_id": cust_id,
        },
    ).json()

    # Bob submits claim with sensitive details
    claim = client.post(
        f"/api/v1/reports/{found_rep['report_id']}/claims",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={"ownership_evidence": "Contains student card 12345678 and receipt for groceries"},
    ).json()
    claim_id = claim["claim_id"]

    # Bob (Owner) can see the evidence
    bob_view = client.get(
        f"/api/v1/claims/{claim_id}",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert bob_view.status_code == 200
    assert "Contains student card 12345678" in bob_view.json()["ownership_evidence"]

    # Staff can see the evidence
    staff_view = client.get(
        f"/api/v1/claims/{claim_id}",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert staff_view.status_code == 200
    assert "Contains student card 12345678" in staff_view.json()["ownership_evidence"]

    # Charlie (Unrelated registered user) receives 403 Forbidden
    charlie_view = client.get(
        f"/api/v1/claims/{claim_id}",
        headers={"Authorization": f"Bearer {charlie_token}"},
    )
    assert charlie_view.status_code == 403

    # Alice (Finder) also cannot view claimant's private evidence -> 403 Forbidden
    alice_view = client.get(
        f"/api/v1/claims/{claim_id}",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert alice_view.status_code == 403


def test_staff_claim_review_and_self_review_prevention(client: TestClient, claims_fixture_data):
    """Test staff review queue, self-review disallowance, request-more-info workflow, and approval."""
    alice_token = get_token(client, "alice.finder@example.com")
    bob_token = get_token(client, "bob.owner@example.com")
    staff1_token = get_token(client, "staff1.claims@example.com")
    staff2_token = get_token(client, "staff2.claims@example.com")

    cat_id = claims_fixture_data["category_id"]
    cust_id = claims_fixture_data["custody_id"]
    now = datetime.now(timezone.utc).isoformat()

    # 1. Alice creates found report
    rep = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Sony Headphones",
            "description": "Black over-ear WH-1000XM5 headphones",
            "date_lost_found": now,
            "location": "Quiet Study Room 4",
            "found_location": "Table 2",
            "custody_location_id": cust_id,
        },
    ).json()
    rep_id = rep["report_id"]

    # 2. Staff 1 files a claim as an individual owner
    claim_by_staff = client.post(
        f"/api/v1/reports/{rep_id}/claims",
        headers={"Authorization": f"Bearer {staff1_token}"},
        json={"ownership_evidence": "Registered to my Sony account with serial XM5-9988"},
    ).json()
    staff_claim_id = claim_by_staff["claim_id"]

    # 3. Staff 1 tries to approve THEIR OWN claim -> 400 Bad Request (Invariant: Disallow self-review)
    self_review = client.post(
        f"/api/v1/staff/claims/{staff_claim_id}/review",
        headers={"Authorization": f"Bearer {staff1_token}"},
        json={"decision": "approve", "notes": "I approve my own headphones"},
    )
    assert self_review.status_code == 400
    assert "not permitted to review or approve their own claims" in self_review.json()["detail"]

    # 4. Staff 1 cancels their claim so Bob can claim it
    client.post(
        f"/api/v1/claims/{staff_claim_id}/cancel",
        headers={"Authorization": f"Bearer {staff1_token}"},
    )

    # Bob submits claim
    bob_claim = client.post(
        f"/api/v1/reports/{rep_id}/claims",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={"ownership_evidence": "My headphones with custom case"},
    ).json()
    bob_claim_id = bob_claim["claim_id"]

    # 5. Staff 1 inspects staff queue
    queue = client.get(
        "/api/v1/staff/claims?claim_status=pending",
        headers={"Authorization": f"Bearer {staff1_token}"},
    )
    assert queue.status_code == 200
    assert any(c["claim_id"] == bob_claim_id for c in queue.json())

    # 6. Staff 1 requests more information from Bob
    req_info = client.post(
        f"/api/v1/staff/claims/{bob_claim_id}/review",
        headers={"Authorization": f"Bearer {staff1_token}"},
        json={
            "decision": "request-info",
            "notes": "Internal note: check serial number with Sony app",
            "decision_reason": "Please provide the Bluetooth MAC address or original purchase invoice.",
        },
    )
    assert req_info.status_code == 200
    assert req_info.json()["status"] == "more_information_requested"

    # Bob sees updated status in his claims
    my_claims = client.get(
        "/api/v1/claims/me",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert my_claims.json()[0]["status"] == "more_information_requested"
    assert "Bluetooth MAC address" in my_claims.json()[0]["decision_reason"]
    # Bob CANNOT see internal review_notes
    assert my_claims.json()[0]["review_notes"] is None

    # 7. Bob responds with additional evidence
    respond_res = client.post(
        f"/api/v1/claims/{bob_claim_id}/respond",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={
            "additional_evidence": "MAC Address is CC:98:8B:11:22:33 from my iPhone Bluetooth device settings.",
        },
    )
    assert respond_res.status_code == 200
    assert respond_res.json()["status"] == "pending"
    assert "MAC Address is CC:98:8B:11:22:33" in respond_res.json()["ownership_evidence"]

    # 8. Staff 2 approves the claim
    approve_res = client.post(
        f"/api/v1/staff/claims/{bob_claim_id}/review",
        headers={"Authorization": f"Bearer {staff2_token}"},
        json={
            "decision": "approve",
            "notes": "MAC address matches box in storage",
            "decision_reason": "Verified MAC address against custody inventory.",
        },
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"
    assert approve_res.json()["reviewed_by"] == claims_fixture_data["staff2"].user_id
    assert approve_res.json()["reviewer_name"] == "Staff Reviewer Two"

    # In-app notification for Bob
    bob_notifs = client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert any("Claim Approved!" in n["title"] for n in bob_notifs.json())
