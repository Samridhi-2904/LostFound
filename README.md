# Campus Lost & Found Management System

[![Backend Tests](https://img.shields.io/badge/Backend%20Tests-42%2F42%20Passing-brightgreen)]()
[![Frontend Build](https://img.shields.io/badge/Frontend%20Build-Vite%20%2B%20TypeScript%20Passing-brightgreen)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688)]()
[![React](https://img.shields.io/badge/React-19%20%7C%20TypeScript-61DAFB)]()
[![Security](https://img.shields.io/badge/Password%20Hashing-Argon2id-blue)]()

A complete, role-based web application engineered for campus lost and found management. The system allows visitors to search verified items safely, enables students to submit lost/found reports and confidential ownership claims, empowers security staff to manage physical custody lockers and verified handovers, and equips administrators with system metrics and immutable audit logs.

Treat [`AGENTS.md`](AGENTS.md) as the architectural source of truth.

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   React 19 + TypeScript Frontend (Vite)                │
│  - Modern Glassmorphism CSS Design System (Responsive down to 360px)   │
│  - Reactive AuthContext (Bearer Token + 30-min Inactivity Auto-Logout) │
│  - Public Search, Report Modals, Advisory Match Panels, Role Dashboards│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST API (JSON)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       FastAPI Backend Architecture                     │
│  ├── API Layer (Versioned: /api/v1/)                                   │
│  │   ├── Auth, Reports, Search, Images, Matches, Claims, Returns, Admin│
│  ├── Security & Authorization                                          │
│  │   ├── Role Dependencies (require_user, require_staff, require_admin)│
│  │   └── Argon2id Password Hashing + JWT Revocation System             │
│  ├── Business Service Layer                                            │
│  │   ├── Deterministic Advisory Matching Engine (Multi-signal scoring) │
│  │   ├── Report & Claim State Machine Service                          │
│  │   └── Custody Tracking & Handover Verification Service              │
│  └── Data Layer                                                        │
│      ├── SQLAlchemy 2.0 ORM + Alembic Schema Migrations                │
│      └── SQLite (Development) / PostgreSQL (Production Compatible)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Core Safety Invariants & Privacy Boundaries

1. **Strict Multi-Tenant Privacy Boundaries**:
   - Public visitors only see public-safe report fields. Precise custody locker locations (e.g. `Keypad PIN: 4892`) and finder contact details are restricted exclusively to authorized staff and administrators.
   - Ownership evidence submitted by claimants is confidential and viewable only by the claimant and reviewing staff/admin.
2. **Deterministic Advisory Matching**:
   - The matching engine uses weighted heuristics across category, brand, colour, date proximity, and text similarity. Matches are strictly **advisory suggestions for human review** and never automatically approve ownership claims.
3. **Verified Handover Requirement (`Returned` State)**:
   - An item **cannot** simply have its status changed to `returned`. It requires an approved claim and an officially recorded physical handover confirmation (recipient ID inspection, condition notes, recipient signature/confirmation).
4. **Self-Review Prevention**:
   - Staff members cannot review, approve, or reject claims filed on reports they created.
5. **Role Escalation Prevention**:
   - Public user registration strictly rejects attempts to specify `staff` or `admin` roles.
6. **Inactivity Session Invalidation**:
   - The frontend automatically clears tokens and logs users out after 30 minutes of inactivity (NFR-03). Sign-out revokes access tokens on both client and server.

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python 3.12+** (tested with Python 3.13 and 3.14)
- **Node.js 18+** & **npm 9+** (tested with Node v24.16.0 & npm 11.7.0)
- **Git**

---

### Step 1: Backend Setup

1. **Create and activate Python virtual environment**:
   ```powershell
   # Windows PowerShell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. **Install backend dependencies**:
   ```powershell
   pip install -r backend/requirements.txt
   ```

3. **Configure environment**:
   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```

4. **Run database migrations**:
   ```powershell
   cd backend
   alembic upgrade head
   ```

5. **Seed demo accounts and sample campus data**:
   ```powershell
   python scripts/seed_demo_data.py
   ```

6. **Start FastAPI backend development server**:
   ```powershell
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   Backend API docs will be available at: **http://127.0.0.1:8000/docs**

---

### Step 2: Frontend Setup

Open a new terminal window:

1. **Navigate to `frontend/` and install packages**:
   ```powershell
   cd frontend
   npm install
   ```

2. **Start Vite development server**:
   ```powershell
   npm run dev
   ```
   Open your browser at: **http://localhost:5173**

---

## 👥 Demo Accounts

The database seed script (`backend/scripts/seed_demo_data.py`) provisions the following accounts:

| Role | Email | Password | Permissions & Dashboard Access |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@campus.edu` | `AdminSecret123!` | System stats, User Directory (role promotion), Categories CRUD, Custody Locker PINs, System Audit Logs |
| **Staff Member** | `staff@campus.edu` | `StaffSecret123!` | Report Moderation Queue, Claims Review, Handover Confirmations, Custody Relocations, Archival/Disposal |
| **Student (Alice)** | `alice@campus.edu` | `StudentPass123!` | File lost/found reports, view matches, submit ownership claim, inspect return records |
| **Student (Bob)** | `bob@campus.edu` | `StudentPass123!` | File lost/found reports, deposited found laptop at Campus Vault |

---

## 🧪 Verification & Test Suite

### 1. Backend Automated Tests (42 Passing Tests)
Execute all tests using `pytest`:
```powershell
# From project root
.\.venv\Scripts\python.exe -m pytest backend/tests -v
```

Test suite coverage includes:
- `test_auth.py` (12 tests): Registration, Argon2id hashing, role escalation blocking, login, JWT token revocation, profile updates.
- `test_reports.py` (6 tests): Lost/Found report creation, category isolation, custody location privacy masking, edit/close permissions, invalid status transitions.
- `test_phase5.py` (3 tests): Search filtering with pagination, validated image upload security (MIME/size/extension), deterministic advisory matching.
- `test_claims.py` (4 tests): Claim creation, duplicate claim blocking, confidential evidence privacy, staff review & self-review prevention.
- `test_phase7.py` (5 tests): Verified handover confirmation, custody relocation, policy-controlled archival/disposal, admin audit log inspection.
- `test_phase8.py` (2 tests): Operational dashboard metric calculations, admin user role management & self-lockout prevention.
- `test_e2e_journey.py` (1 test): Complete multi-actor end-to-end journey simulation.
- `test_models.py` (7 tests) & `test_health.py` (2 tests): Schema integrity, relationship cascades, health checks.

### 2. Frontend Production Build & TypeScript Verification
```powershell
cd frontend
npm run build
```
Builds cleanly with zero TypeScript errors (`tsc -b && vite build`) in ~1.4s.

---

## 📂 Project Structure

```text
LostFound/
├── AGENTS.md                          # Non-negotiable safety rules & constraints
├── README.md                          # Project documentation & quickstart
├── pyproject.toml                     # Pytest and tooling configuration
├── pyrefly.toml                       # Python type checking configuration

├── backend/
│   ├── alembic/                       # Schema migration version control
│   ├── app/
│   │   ├── api/v1/                    # Versioned FastAPI endpoints
│   │   ├── core/                      # Settings, security & config
│   │   ├── db/                        # Database session & Base declarative
│   │   ├── models/                    # SQLAlchemy 2.0 ORM domain models
│   │   ├── schemas/                   # Pydantic v2 DTO validation schemas
│   │   └── services/                  # Business logic & state machine transitions
│   ├── scripts/
│   │   └── seed_demo_data.py          # Demo data seeding script
│   └── tests/                         # 42 Automated pytest test suites
└── frontend/
    ├── src/
    │   ├── context/AuthContext.tsx    # Reactive auth state & auto-logout
    │   ├── services/api.ts            # Type-safe Axios client with interceptors
    │   ├── pages/                     # React pages (Home, Search, Details, Dashboards)
    │   ├── types/                     # Shared TypeScript interfaces
    │   └── index.css                  # Custom Glassmorphic design system
    └── package.json                   # React 19, Vite, Lucide icons
```

