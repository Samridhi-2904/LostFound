import argparse
import sys
from pathlib import Path

# Add backend directory to path if running directly
backend_dir = Path(__file__).resolve().parents[2]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.history import AuditLog
from app.models.user import User
from app.core.security import hash_password


def init_admin(email: str, full_name: str, password: str) -> None:
    """Safely provision the initial system administrator."""
    db = SessionLocal()
    try:
        normalized_email = email.lower().strip()
        existing = db.scalar(select(User).where(User.email == normalized_email))
        if existing:
            if existing.role != UserRole.ADMIN:
                print(f"[!] User with email '{normalized_email}' exists but has role '{existing.role.value}'.")
            else:
                print(f"[*] Administrator '{normalized_email}' already exists.")
            return

        admin_user = User(
            full_name=full_name.strip(),
            email=normalized_email,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        audit = AuditLog(
            actor_user_id=admin_user.user_id,
            action="ADMIN_INITIALIZED",
            entity_type="User",
            entity_id=str(admin_user.user_id),
            summary=f'{{"email": "{normalized_email}", "role": "admin"}}',
        )
        db.add(audit)
        db.commit()
        print(f"[✓] Administrator '{normalized_email}' successfully provisioned (ID: {admin_user.user_id}).")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Safely provision the initial system administrator.")
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--name", default="System Administrator", help="Administrator full name")
    parser.add_argument("--password", required=True, help="Secure password for administrator")

    args = parser.parse_args()
    if len(args.password) < 8:
        print("[!] Error: Password must be at least 8 characters long.", file=sys.stderr)
        sys.exit(1)

    init_admin(email=args.email, full_name=args.name, password=args.password)


if __name__ == "__main__":
    main()
