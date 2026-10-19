import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.core.init_admin import init_admin


def test_register_user_success(client: TestClient):
    """Test standard public registration creates an active user with 'user' role."""
    payload = {
        "full_name": "Alice Cooper",
        "email": "alice@example.com",
        "password": "StrongPassword123!",
        "phone": "+1234567890",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "alice@example.com"
    assert data["full_name"] == "Alice Cooper"
    assert data["role"] == "user"
    assert data["is_active"] is True
    assert "password_hash" not in data


def test_register_duplicate_email(client: TestClient):
    """Test duplicate registration returns 409 Conflict."""
    payload = {
        "full_name": "Bob Marley",
        "email": "bob@example.com",
        "password": "StrongPassword123!",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Attempt to register again with same email (even with different case)
    payload["email"] = "BOB@example.com"
    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_register_role_escalation_prevention(client: TestClient):
    """Test that public registration forbids injecting a privileged role."""
    payload = {
        "full_name": "Attacker",
        "email": "attacker@example.com",
        "password": "StrongPassword123!",
        "role": "admin",  # Attacker attempts privilege escalation
    }
    response = client.post("/api/v1/auth/register", json=payload)
    # Extra fields are forbidden by Pydantic schema
    assert response.status_code == 422


def test_password_hashing(db_session: Session, client: TestClient):
    """Test that stored passwords are encrypted using Argon2id."""
    password = "SuperSecretPassword123!"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Cipher", "email": "cipher@example.com", "password": password},
    )

    from sqlalchemy import select
    user = db_session.scalar(select(User).where(User.email == "cipher@example.com"))
    assert user is not None
    assert user.password_hash != password
    assert user.password_hash.startswith("$argon2id$")
    assert verify_password(password, user.password_hash)


def test_login_success(client: TestClient):
    """Test authentication with valid credentials returns a valid JWT token."""
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "David", "email": "david@example.com", "password": "Password123!"},
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "david@example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    assert token_data["expires_in"] > 0


def test_login_invalid_password(client: TestClient):
    """Test authentication with invalid password returns 401."""
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Eva", "email": "eva@example.com", "password": "Password123!"},
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "eva@example.com", "password": "WrongPassword!"},
    )
    assert login_resp.status_code == 401
    assert "Incorrect email or password" in login_resp.json()["detail"]


def test_login_inactive_user(db_session: Session, client: TestClient):
    """Test that inactive accounts cannot authenticate."""
    user = User(
        full_name="Inactive User",
        email="inactive@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.USER,
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "inactive@example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 403
    assert "inactive" in login_resp.json()["detail"].lower()


def test_get_current_user_me(client: TestClient):
    """Test /api/v1/auth/me returns current user profile when authenticated."""
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Frank", "email": "frank@example.com", "password": "Password123!"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "frank@example.com", "password": "Password123!"},
    ).json()["access_token"]

    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    data = me_resp.json()
    assert data["email"] == "frank@example.com"
    assert data["full_name"] == "Frank"


def test_logout_and_revocation(client: TestClient):
    """Test that sign-out actively revokes the token, causing subsequent requests to fail."""
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Grace", "email": "grace@example.com", "password": "Password123!"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "grace@example.com", "password": "Password123!"},
    ).json()["access_token"]

    # Verify access works before logout
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200

    # Logout
    logout_resp = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_resp.status_code == 200
    assert "Successfully logged out" in logout_resp.json()["message"]

    # Request after logout must be rejected with 401
    followup_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert followup_resp.status_code == 401
    assert "revoked" in followup_resp.json()["detail"].lower()


def test_update_profile(client: TestClient):
    """Test user profile update via PATCH /api/v1/users/me."""
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Helen", "email": "helen@example.com", "password": "Password123!"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "helen@example.com", "password": "Password123!"},
    ).json()["access_token"]

    update_resp = client.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"full_name": "Helen Keller", "phone": "555-1234"},
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["full_name"] == "Helen Keller"
    assert data["phone"] == "555-1234"


def test_update_password(client: TestClient):
    """Test password update requiring verification of current password."""
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Ivan", "email": "ivan@example.com", "password": "OldPassword123!"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "ivan@example.com", "password": "OldPassword123!"},
    ).json()["access_token"]

    # Attempt update with wrong current password
    wrong_resp = client.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "WrongPassword!", "new_password": "NewPassword123!"},
    )
    assert wrong_resp.status_code == 400

    # Successful password update
    ok_resp = client.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "OldPassword123!", "new_password": "NewPassword123!"},
    )
    assert ok_resp.status_code == 200

    # Verify login with new password works
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "ivan@example.com", "password": "NewPassword123!"},
    )
    assert new_login.status_code == 200


def test_role_based_access_control(db_session: Session, client: TestClient):
    """Test role dependencies: regular user, staff member, and administrator."""
    # Create a normal user
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Normal User", "email": "user@example.com", "password": "Password123!"},
    )
    user_token = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "Password123!"},
    ).json()["access_token"]

    # Create a staff member directly
    staff_user = User(
        full_name="Staff Member",
        email="staff@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.STAFF,
        is_active=True,
    )
    db_session.add(staff_user)
    db_session.commit()
    staff_token = client.post(
        "/api/v1/auth/login",
        json={"email": "staff@example.com", "password": "Password123!"},
    ).json()["access_token"]

    # Create an admin user directly
    admin_user = User(
        full_name="Admin User",
        email="admin@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin_user)
    db_session.commit()
    admin_token = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "Password123!"},
    ).json()["access_token"]

    # Normal user access:
    assert client.get("/api/v1/users/role-check/staff", headers={"Authorization": f"Bearer {user_token}"}).status_code == 403
    assert client.get("/api/v1/users/role-check/admin", headers={"Authorization": f"Bearer {user_token}"}).status_code == 403

    # Staff access:
    assert client.get("/api/v1/users/role-check/staff", headers={"Authorization": f"Bearer {staff_token}"}).status_code == 200
    assert client.get("/api/v1/users/role-check/admin", headers={"Authorization": f"Bearer {staff_token}"}).status_code == 403

    # Admin access:
    assert client.get("/api/v1/users/role-check/staff", headers={"Authorization": f"Bearer {admin_token}"}).status_code == 200
    assert client.get("/api/v1/users/role-check/admin", headers={"Authorization": f"Bearer {admin_token}"}).status_code == 200
