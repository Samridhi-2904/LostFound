# Lost and Found Management System

A role-based web application for reporting and searching lost/found items, suggesting potential matches, reviewing ownership claims, managing custody, and recording verified item handovers. These documents are implementation instructions and a design plan; they do **not** mean the application features have already been built or tested.

## Actors
- Visitor — browse and search public-safe report information.
- Registered User — manage own reports, submit claims, view own matches/notifications.
- Staff Member — review reports and claims, manage authorized custody workflows, record handovers.
- Administrator — manage users/roles, categories, custody locations, report moderation, dashboard, and audit records.

## Planned technology stack
- Backend: Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic.
- Local database: SQLite; keep configuration compatible with PostgreSQL.
- Frontend (later phase): React, Vite, TypeScript.
- Backend tests: pytest.
- Local development image storage with validated files and database metadata.

## Instruction and design files
- `AGENTS.md` — rules for the coding agent and safety invariants.
- `docs/REQUIREMENTS.md` — actors, FR-01 to FR-25, NFRs, business rules, acceptance checklist.
- `docs/ARCHITECTURE.md` — component boundaries and security design.
- `docs/DATABASE.md` — entity inventory, relationships, statuses, privacy constraints.
- `docs/API.md` — planned versioned endpoint contract.
- `docs/UI.md` — actor-specific screens and UX/privacy rules.
- `docs/IMPLEMENTATION_PLAN.md` — incremental phases and exit checks.
- `docs/TESTING.md` — verification strategy and end-to-end acceptance flow.
- `docs/CODING_RULES.md` — implementation standards.
- `docs/LAB_AND_VIVA.md` — project explanation and viva preparation.

## Suggested repository structure
Adapt to the existing repository rather than replacing it blindly.
```text
lost-and-found/
├── AGENTS.md
├── README.md
├── docs/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── tests/
│   ├── alembic/
│   ├── requirements.txt
│   └── .env.example
└── frontend/                 # created only in planned frontend phase
    ├── src/
    ├── package.json
    └── .env.example
```

## Start with Antigravity
1. Put `AGENTS.md` and the `docs/` directory in the project root.
2. Ask Antigravity to read `AGENTS.md` and every document under `docs/`.
3. Ask it to perform **Phase 0 only** first: inspect the repository, summarize existing code and Git status, identify conflicts/gaps, and propose the smallest safe changes. Do not let it generate the whole application at once.
4. After reviewing the inspection, ask it to implement Phase 1 only. Phase 1 is backend foundation; no frontend yet.
5. Continue one phase at a time, reviewing test results and diffs before moving on.

Suggested first prompt:
> Read `AGENTS.md` and every file in `docs/`. Perform only Phase 0 from `docs/IMPLEMENTATION_PLAN.md`. Inspect the existing repository and Git status, preserve useful code, and report the current structure, what already works, risks, and the exact plan for Phase 1. Do not edit files or create the frontend during this inspection phase.

## Setup and commands

### Backend Setup (Verified in Phase 1)
1. **Create and activate virtual environment (Python 3.12+; tested with Python 3.13):**
   ```powershell
   py -3.13 -m venv backend/.venv
   backend\.venv\Scripts\activate
   ```
2. **Install dependencies:**
   ```powershell
   pip install -r backend/requirements.txt
   ```
3. **Environment configuration:**
   Copy `backend/.env.example` to `backend/.env` if customizing defaults:
   ```powershell
   copy backend\.env.example backend\.env
   ```
4. **Run tests:**
   ```powershell
   cd backend
   .venv\Scripts\pytest -v
   ```
5. **Run backend development server:**
   ```powershell
   cd backend
   .venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

## Important workflow guarantees
- Public users cannot see ownership evidence or precise restricted custody/contact details.
- A potential match is only a suggestion, not proof of ownership.
- Only staff/admin can decide claims.
- Returned requires an approved claim and persisted handover confirmation.
- Status, custody, claim decisions, role changes, and important administrative changes must be traceable.
- Performance and availability figures are targets until measured.

## Current status

### Implemented and Verified (Phase 1)
- Git repository initialization and `.gitignore` setup.
- Package structure: `backend/app/` (`core`, `db`, `models`, `schemas`, `services`, `api`) and `backend/tests/`.
- Modern dependencies in `backend/requirements.txt`: FastAPI, Uvicorn, Pydantic v2, Pydantic Settings, SQLAlchemy 2.x, Alembic, Pytest, HTTPX.
- Environment loading via Pydantic Settings in `backend/app/core/config.py` with parsed CORS origins.
- SQLAlchemy 2.x engine, SessionLocal, and `get_db` session generator in `backend/app/db/session.py`.
- Base declarative model class (`Base`) in `backend/app/db/base.py`.
- Main FastAPI app instance in `backend/app/main.py` with CORS middleware and `GET /health` endpoint returning `{"status": "ok"}`.
- Smoke tests in `backend/tests/test_health.py` passing with 100% success rate.

### Not Yet Implemented (Planned for Next Phases)
- **Phase 2:** Domain models (User, StaffProfile, Category, CustodyLocation, ItemReport, subtype design, ItemImage, MatchSuggestion, Claim, Return, Notification, ReportStatusHistory, AuditLog) and Alembic migrations.
- **Phase 3:** Authentication, authorization, role dependencies, password hashing (Argon2id), session management.
- **Phases 4–8:** Report workflows, search/matching, claims/decisions, custody/returns, admin dashboard and audit logs.
- **Phases 9–10:** React + Vite + TypeScript frontend.

