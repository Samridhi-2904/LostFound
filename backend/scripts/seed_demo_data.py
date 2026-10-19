"""Idempotent seed script to initialize demo accounts, categories, custody locations,
and sample lost/found reports for testing and viva demonstrations.

Usage:
    python backend/scripts/seed_demo_data.py
"""

import sys
import os
from datetime import datetime, timezone, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models import (
    User,
    StaffProfile,
    Category,
    CustodyLocation,
    ItemReport,
    LostItem,
    FoundItem,
    MatchSuggestion,
    Claim,
    Return,
    UserRole,
    ReportType,
    LifecycleStatus,
    ModerationStatus,
    ClaimStatus,
    MatchStatus,
)
from app.core.security import hash_password


def seed_all():
    db = SessionLocal()
    try:
        print("[*] Starting Lost & Found demo data seeding...")

        # 1. Seed Users
        # Admin
        admin = db.query(User).filter(User.email == "admin@campus.edu").first()
        if not admin:
            admin = User(
                email="admin@campus.edu",
                password_hash=hash_password("AdminSecret123!"),
                full_name="Dr. Eleanor Vance (System Admin)",
                role=UserRole.ADMIN,
                phone="+15550001111",
                is_active=True,
            )
            db.add(admin)
            db.flush()
            print("  [OK] Created Admin: admin@campus.edu (AdminSecret123!)")

        # Staff
        staff = db.query(User).filter(User.email == "staff@campus.edu").first()
        if not staff:
            staff = User(
                email="staff@campus.edu",
                password_hash=hash_password("StaffSecret123!"),
                full_name="Officer Mike Reynolds (Campus Security)",
                role=UserRole.STAFF,
                phone="+15550002222",
                is_active=True,
            )
            db.add(staff)
            db.flush()
            staff_profile = StaffProfile(
                user_id=staff.user_id,
                department="Campus Security & Custody Services",
                employee_code="SEC-101",
            )
            db.add(staff_profile)
            print("  [OK] Created Staff: staff@campus.edu (StaffSecret123!)")

        # Student Alice
        alice = db.query(User).filter(User.email == "alice@campus.edu").first()
        if not alice:
            alice = User(
                email="alice@campus.edu",
                password_hash=hash_password("StudentPass123!"),
                full_name="Alice Walker",
                role=UserRole.USER,
                phone="+15550003333",
                is_active=True,
            )
            db.add(alice)
            db.flush()
            print("  [OK] Created Student Alice: alice@campus.edu (StudentPass123!)")

        # Student Bob
        bob = db.query(User).filter(User.email == "bob@campus.edu").first()
        if not bob:
            bob = User(
                email="bob@campus.edu",
                password_hash=hash_password("StudentPass123!"),
                full_name="Bob Finder",
                role=UserRole.USER,
                phone="+15550004444",
                is_active=True,
            )
            db.add(bob)
            db.flush()
            print("  [OK] Created Student Bob: bob@campus.edu (StudentPass123!)")

        db.commit()

        # 2. Seed Categories
        categories_data = [
            ("Electronics & Computers", "Laptops, phones, tablets, smartwatches, chargers, headphones"),
            ("Wallets, Bags & Cards", "Wallets, purses, backpacks, student IDs, credit cards, keychains"),
            ("Books & Stationery", "Textbooks, notebooks, scientific calculators, stationery sets"),
            ("Clothing & Apparel", "Jackets, hoodies, caps, sunglasses, scarves, umbrellas"),
            ("Jewellery & Personal Valuables", "Rings, necklaces, wristwatches, prescription glasses"),
        ]
        cat_map = {}
        for name, desc in categories_data:
            cat = db.query(Category).filter(Category.category_name == name).first()
            if not cat:
                cat = Category(category_name=name, description=desc, is_active=True)
                db.add(cat)
                db.flush()
                print(f"  [OK] Created Category: {name}")
            cat_map[name] = cat
        db.commit()

        # 3. Seed Custody Locations
        locations_data = [
            (
                "Central Campus Security Vault",
                "Administration Building Room 102",
                "Lockbox Keypad PIN: 4892. High-value safe requires dual supervisor keys.",
            ),
            (
                "Library Circulation Desk",
                "Science & Engineering Library Ground Floor",
                "Behind circulation counter drawer #3. Key with senior librarian on duty.",
            ),
            (
                "Student Union Info Hub",
                "Student Center 1st Floor Reception",
                "Locker #07. Master badge scan required for access.",
            ),
        ]
        loc_map = {}
        for name, desc, restricted in locations_data:
            loc = db.query(CustodyLocation).filter(CustodyLocation.name == name).first()
            if not loc:
                loc = CustodyLocation(
                    name=name,
                    description=desc,
                    restricted_details=restricted,
                    is_active=True,
                )
                db.add(loc)
                db.flush()
                print(f"  [OK] Created Custody Location: {name}")
            loc_map[name] = loc
        db.commit()

        # 4. Seed Sample Reports
        now = datetime.now(timezone.utc)
        elec_cat = cat_map["Electronics & Computers"]
        vault_loc = loc_map["Central Campus Security Vault"]

        # Found Item: Dell XPS 15
        found_xps = db.query(ItemReport).filter(ItemReport.case_reference == "FR-DEMO-001").first()
        if not found_xps:
            found_xps = ItemReport(
                case_reference="FR-DEMO-001",
                item_name="Silver Dell XPS 15 Laptop in Black Sleeve",
                description="Found a 15-inch silver Dell XPS laptop with a distinctive Tux penguin sticker on the lid. Left unattended on 2nd floor library table.",
                report_type=ReportType.FOUND,
                category_id=elec_cat.category_id,
                created_by=bob.user_id,
                date_lost_found=now - timedelta(days=2),
                location="Science Library 2nd Floor",
                colour="Silver",
                brand="Dell",
                distinguishing_marks="Linux penguin sticker on lid",
                moderation_status=ModerationStatus.VERIFIED,
                lifecycle_status=LifecycleStatus.OPEN,
                contact_info_restricted="Bob Finder cell: +15550004444",
                verified_by=staff.user_id,
                verified_at=now - timedelta(days=1),
            )
            db.add(found_xps)
            db.flush()
            found_item_detail = FoundItem(
                report_id=found_xps.report_id,
                found_location="Science Library 2nd Floor Study Table",
                custody_location_id=vault_loc.custody_location_id,
                storage_reference="Security Vault Shelf B, Box 14",
            )
            db.add(found_item_detail)
            print("  [OK] Created Sample Found Report: FR-DEMO-001 (Dell XPS 15)")

        # Lost Item: Dell XPS 15 reported by Alice
        lost_xps = db.query(ItemReport).filter(ItemReport.case_reference == "LR-DEMO-001").first()
        if not lost_xps:
            lost_xps = ItemReport(
                case_reference="LR-DEMO-001",
                item_name="Dell XPS 15 Laptop with Linux sticker",
                description="My silver Dell XPS 15 9520 laptop with a Linux penguin sticker on the cover. Kept in a black neoprene zip sleeve.",
                report_type=ReportType.LOST,
                category_id=elec_cat.category_id,
                created_by=alice.user_id,
                date_lost_found=now - timedelta(days=2, hours=3),
                location="Science Library",
                colour="Silver",
                brand="Dell",
                distinguishing_marks="Ubuntu sticker on top cover",
                moderation_status=ModerationStatus.VERIFIED,
                lifecycle_status=LifecycleStatus.OPEN,
                contact_info_restricted="Alice Walker +15550003333",
                verified_by=staff.user_id,
                verified_at=now - timedelta(days=1),
            )
            db.add(lost_xps)
            db.flush()
            lost_item_detail = LostItem(
                report_id=lost_xps.report_id,
                last_seen_location="Science Library 2nd Floor Study Carrel #4",
                reward_offered="$50",
            )
            db.add(lost_item_detail)
            print("  [OK] Created Sample Lost Report: LR-DEMO-001 (Alice's Dell XPS)")

        # Found Item 2: Brown leather wallet
        wallet_cat = cat_map["Wallets, Bags & Cards"]
        lib_loc = loc_map["Library Circulation Desk"]
        found_wallet = db.query(ItemReport).filter(ItemReport.case_reference == "FR-DEMO-002").first()
        if not found_wallet:
            found_wallet = ItemReport(
                case_reference="FR-DEMO-002",
                item_name="Brown Leather Bi-fold Wallet",
                description="Brown leather Timberland wallet found on bench near library entrance. Contains student identification card and campus meal pass.",
                report_type=ReportType.FOUND,
                category_id=wallet_cat.category_id,
                created_by=bob.user_id,
                date_lost_found=now - timedelta(hours=18),
                location="Library Entrance Bench",
                colour="Brown",
                brand="Timberland",
                distinguishing_marks="Embossed Timberland logo",
                moderation_status=ModerationStatus.VERIFIED,
                lifecycle_status=LifecycleStatus.OPEN,
                contact_info_restricted="Circulation assistant on duty",
                verified_by=staff.user_id,
                verified_at=now - timedelta(hours=12),
            )
            db.add(found_wallet)
            db.flush()
            found_wallet_detail = FoundItem(
                report_id=found_wallet.report_id,
                found_location="Library Entrance Bench",
                custody_location_id=lib_loc.custody_location_id,
                storage_reference="Circulation Drawer #3, Envelope #09",
            )
            db.add(found_wallet_detail)
            print("  [OK] Created Sample Found Report: FR-DEMO-002 (Brown Wallet)")

        db.commit()

        # 5. Advisory Match Suggestion between Alice's lost XPS and Bob's found XPS
        if lost_xps and found_xps:
            match = db.query(MatchSuggestion).filter(
                MatchSuggestion.lost_report_id == lost_xps.report_id,
                MatchSuggestion.found_report_id == found_xps.report_id,
            ).first()
            if not match:
                import json
                match = MatchSuggestion(
                    lost_report_id=lost_xps.report_id,
                    found_report_id=found_xps.report_id,
                    score=0.88,
                    status=MatchStatus.NEW,
                    match_reasons=json.dumps({
                        "category_match": 1.0,
                        "brand_match": 1.0,
                        "colour_match": 1.0,
                        "text_similarity": 0.85,
                        "date_proximity_days": 0.12,
                    }),
                )
                db.add(match)
                db.commit()
                print("  [OK] Created Advisory Match: Lost LR-DEMO-001 <-> Found FR-DEMO-001 (Score: 0.88)")

        print("\n[SUCCESS] Seeding complete! All demo data is ready.")
        print("\nDemo Accounts for Evaluation:")
        print("+---------------+------------------------+-------------------+")
        print("| Role          | Email                  | Password          |")
        print("+---------------+------------------------+-------------------+")
        print("| Administrator | admin@campus.edu       | AdminSecret123!   |")
        print("| Staff Member  | staff@campus.edu       | StaffSecret123!   |")
        print("| Student (A)   | alice@campus.edu       | StudentPass123!   |")
        print("| Student (B)   | bob@campus.edu         | StudentPass123!   |")
        print("+---------------+------------------------+-------------------+")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error during seeding: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
