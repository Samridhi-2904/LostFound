from datetime import datetime, timezone, timedelta
import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User


@pytest.fixture
def phase5_users(db_session: Session):
    """Seed test users for Phase 5 tests."""
    u1 = User(
        full_name="Alice Owner",
        email="alice.owner@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.USER,
        is_active=True,
    )
    u2 = User(
        full_name="Bob Finder",
        email="bob.finder@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.USER,
        is_active=True,
    )
    u3 = User(
        full_name="Charlie Stranger",
        email="charlie@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.USER,
        is_active=True,
    )
    staff = User(
        full_name="Officer Smith",
        email="staff.phase5@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.STAFF,
        is_active=True,
    )
    admin = User(
        full_name="Admin Chief",
        email="admin.phase5@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add_all([u1, u2, u3, staff, admin])
    db_session.commit()
    return {"alice": u1, "bob": u2, "charlie": u3, "staff": staff, "admin": admin}


def get_token(client: TestClient, email: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return res.json()["access_token"]


def test_combined_search_filters_and_pagination(client: TestClient, phase5_users):
    """Test searching with keyword, category, date range, location, colour, and pagination."""
    admin_token = get_token(client, "admin.phase5@example.com")
    staff_token = get_token(client, "staff.phase5@example.com")
    alice_token = get_token(client, "alice.owner@example.com")

    # Setup 2 categories
    cat1_id = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "Laptops & Tablets"},
    ).json()["category_id"]

    cat2_id = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "Keys & Wallets"},
    ).json()["category_id"]

    now = datetime.now(timezone.utc)
    # Create 3 reports with distinct attributes and verify them so public search sees them
    for i, (name, cat, col, loc, d_offset) in enumerate([
        ("Dell XPS 15 Laptop", cat1_id, "Silver", "Engineering Hall", 1),
        ("Lenovo ThinkPad Laptop", cat1_id, "Black", "Library Floor 1", 3),
        ("Leather Bi-Fold Wallet", cat2_id, "Black", "Cafeteria", 5),
    ]):
        rep = client.post(
            "/api/v1/reports",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={
                "report_type": "lost",
                "category_id": cat,
                "item_name": name,
                "description": f"Detailed description for item {name}",
                "date_lost_found": (now - timedelta(days=d_offset)).isoformat(),
                "location": loc,
                "colour": col,
            },
        ).json()
        # Verify via staff so it enters public verified pool
        client.post(
            f"/api/v1/staff/reports/{rep['report_id']}/verify",
            headers={"Authorization": f"Bearer {staff_token}"},
            json={"reason": "Verified for search tests"},
        )

    # 1. Keyword search 'Laptop'
    res_kw = client.get("/api/v1/reports?q=Laptop")
    assert res_kw.status_code == 200
    assert len(res_kw.json()) == 2

    # 2. Category filter
    res_cat = client.get(f"/api/v1/reports?category_id={cat2_id}")
    assert len(res_cat.json()) == 1
    assert res_cat.json()[0]["item_name"] == "Leather Bi-Fold Wallet"

    # 3. Colour and keyword filter combined
    res_col = client.get("/api/v1/reports?q=Laptop&colour=Black")
    assert len(res_col.json()) == 1
    assert res_col.json()[0]["item_name"] == "Lenovo ThinkPad Laptop"

    # 4. Date range filter
    d_start = (now - timedelta(days=2)).isoformat()
    res_date = client.get("/api/v1/reports", params={"date_from": d_start})
    assert res_date.status_code == 200
    assert len(res_date.json()) == 1
    assert res_date.json()[0]["item_name"] == "Dell XPS 15 Laptop"

    # 5. Pagination
    res_p1 = client.get("/api/v1/reports?page=1&page_size=2")
    assert len(res_p1.json()) == 2
    res_p2 = client.get("/api/v1/reports?page=2&page_size=2")
    assert len(res_p2.json()) == 1


def test_image_upload_validation_and_serving(client: TestClient, phase5_users):
    """Test magic bytes validation, size limits, ownership security, and private serving."""
    admin_token = get_token(client, "admin.phase5@example.com")
    alice_token = get_token(client, "alice.owner@example.com")
    charlie_token = get_token(client, "charlie@example.com")
    staff_token = get_token(client, "staff.phase5@example.com")

    cat_id = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "Watches"},
    ).json()["category_id"]

    # Alice creates a lost report (starts unverified)
    report_id = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "lost",
            "category_id": cat_id,
            "item_name": "Casio G-Shock",
            "description": "Black digital watch",
            "date_lost_found": datetime.now(timezone.utc).isoformat(),
            "location": "Gym Locker",
        },
    ).json()["report_id"]

    # Valid JPEG with magic bytes: \xFF\xD8\xFF\xE0...
    valid_jpeg = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00" + b"\x00" * 100
    # Valid PNG with magic bytes: \x89PNG\r\n\x1a\n...
    valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 50
    # Spoofed file (text file disguised with .jpg extension)
    fake_image = b"Hello, I am actually a plain text file pretending to be a JPEG image!"

    # 1. Non-owner (Charlie) cannot upload to Alice's report -> 403 Forbidden
    res_forbid = client.post(
        f"/api/v1/reports/{report_id}/images",
        headers={"Authorization": f"Bearer {charlie_token}"},
        files={"file": ("photo.jpg", io.BytesIO(valid_jpeg), "image/jpeg")},
    )
    assert res_forbid.status_code == 403

    # 2. Upload fake/spoofed file fails -> 415 Unsupported Media Type
    res_fake = client.post(
        f"/api/v1/reports/{report_id}/images",
        headers={"Authorization": f"Bearer {alice_token}"},
        files={"file": ("fake.jpg", io.BytesIO(fake_image), "image/jpeg")},
    )
    assert res_fake.status_code == 415
    assert "Unsupported or invalid image format" in res_fake.json()["detail"]

    # 3. Upload empty file fails -> 400 Bad Request
    res_empty = client.post(
        f"/api/v1/reports/{report_id}/images",
        headers={"Authorization": f"Bearer {alice_token}"},
        files={"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
    )
    assert res_empty.status_code == 400

    # 4. Successful valid JPEG upload by owner
    res_upload_jpg = client.post(
        f"/api/v1/reports/{report_id}/images",
        headers={"Authorization": f"Bearer {alice_token}"},
        files={"file": ("my_watch.jpg", io.BytesIO(valid_jpeg), "image/jpeg")},
        data={"is_primary": "true"},
    )
    assert res_upload_jpg.status_code == 201
    img1 = res_upload_jpg.json()
    assert img1["content_type"] == "image/jpeg"
    assert img1["is_primary"] is True
    image1_id = img1["image_id"]

    # 5. Successful valid PNG upload by owner
    res_upload_png = client.post(
        f"/api/v1/reports/{report_id}/images",
        headers={"Authorization": f"Bearer {alice_token}"},
        files={"file": ("watch_side.png", io.BytesIO(valid_png), "image/png")},
    )
    assert res_upload_png.status_code == 201
    image2_id = res_upload_png.json()["image_id"]

    # 6. Privacy check: unverified report image is protected from anonymous visitors (403)
    res_view_anon = client.get(f"/api/v1/reports/{report_id}/images/{image1_id}")
    assert res_view_anon.status_code == 403

    # 7. Owner (Alice) and Staff can view unverified report image (200)
    res_view_owner = client.get(
        f"/api/v1/reports/{report_id}/images/{image1_id}",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert res_view_owner.status_code == 200
    assert res_view_owner.headers["content-type"] == "image/jpeg"

    # 8. Once staff verifies report, public visitor can stream image
    client.post(
        f"/api/v1/staff/reports/{report_id}/verify",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"reason": "Approved with valid images"},
    )
    res_view_pub = client.get(f"/api/v1/reports/{report_id}/images/{image1_id}")
    assert res_view_pub.status_code == 200

    # 9. Delete image: non-owner forbidden, owner succeeds
    assert client.delete(
        f"/api/v1/reports/{report_id}/images/{image2_id}",
        headers={"Authorization": f"Bearer {charlie_token}"},
    ).status_code == 403

    res_del = client.delete(
        f"/api/v1/reports/{report_id}/images/{image2_id}",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert res_del.status_code == 200
    # Image no longer exists
    assert client.get(f"/api/v1/reports/{report_id}/images/{image2_id}").status_code == 404


def test_deterministic_matching_and_notifications(client: TestClient, phase5_users):
    """Test deterministic multi-attribute matching, duplicate prevention, and in-app notifications."""
    admin_token = get_token(client, "admin.phase5@example.com")
    alice_token = get_token(client, "alice.owner@example.com")
    bob_token = get_token(client, "bob.finder@example.com")
    staff_token = get_token(client, "staff.phase5@example.com")

    cat_id = client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"category_name": "Smartphones"},
    ).json()["category_id"]

    custody_id = client.post(
        "/api/v1/admin/custody-locations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Library Front Desk", "restricted_details": "Locker #12"},
    ).json()["custody_location_id"]

    now = datetime.now(timezone.utc)

    # 1. Alice creates LOST report: iPhone 13 Blue lost in Central Library on Monday
    lost_res = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {alice_token}"},
        json={
            "report_type": "lost",
            "category_id": cat_id,
            "item_name": "Apple iPhone 13",
            "description": "Blue iPhone 13 with clear silicone case and cracked corner",
            "date_lost_found": (now - timedelta(days=2)).isoformat(),
            "location": "Central Library 2nd Floor Study Room",
            "colour": "Blue",
            "brand": "Apple",
        },
    )
    lost_id = lost_res.json()["report_id"]

    # 2. Bob creates FOUND report: Blue Apple iPhone found in Central Library on Tuesday
    found_res = client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {bob_token}"},
        json={
            "report_type": "found",
            "category_id": cat_id,
            "item_name": "Apple iPhone Smartphone",
            "description": "Blue Apple iPhone with clear case",
            "date_lost_found": (now - timedelta(days=1)).isoformat(),
            "location": "Central Library reading tables",
            "colour": "Blue",
            "brand": "Apple",
            "custody_location_id": custody_id,
        },
    )
    found_id = found_res.json()["report_id"]

    # 3. Matching check for Alice (/api/v1/matches/me)
    alice_matches = client.get("/api/v1/matches/me", headers={"Authorization": f"Bearer {alice_token}"}).json()
    assert len(alice_matches) >= 1
    match = alice_matches[0]
    assert match["lost_report_id"] == lost_id
    assert match["found_report_id"] == found_id
    assert match["score"] >= 0.50
    assert match["status"] == "new"

    # Verify explainable match reasons
    reasons = match["match_reasons"]
    assert "category_match" in reasons
    assert "text_similarity" in reasons
    assert "date_proximity_match" in reasons
    assert "location_match" in reasons

    # 4. In-App Notifications: Alice and Bob both receive notifications
    alice_notifs = client.get("/api/v1/notifications/me", headers={"Authorization": f"Bearer {alice_token}"}).json()
    assert len(alice_notifs) >= 1
    match_notif = alice_notifs[0]
    assert match_notif["type"] == "match_found"
    assert match_notif["is_read"] is False
    assert "Apple iPhone 13" in match_notif["message"]
    # Verify no private evidence or secrets leaked in notification
    assert "Password" not in match_notif["message"]

    # Mark notification read
    notif_id = match_notif["notification_id"]
    read_res = client.post(
        f"/api/v1/notifications/{notif_id}/read",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # Mark all notifications read
    all_read = client.post(
        "/api/v1/notifications/read-all",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert all_read.status_code == 200

    # 5. Staff match review queue
    staff_matches = client.get("/api/v1/staff/matches", headers={"Authorization": f"Bearer {staff_token}"}).json()
    assert len(staff_matches) >= 1
    match_id = match["match_id"]

    # Staff marks match reviewed
    rev_res = client.post(
        f"/api/v1/staff/matches/{match_id}/review",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["status"] == "reviewed"

    # Staff dismisses match
    dis_res = client.post(
        f"/api/v1/staff/matches/{match_id}/dismiss",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert dis_res.status_code == 200
    assert dis_res.json()["status"] == "dismissed"
