# Antigravity Project Instructions — Lost and Found Management System

## Mission
Build a reliable, student-understandable web application that helps people report and search lost/found items, lets authorized staff assess claims, and records custody and handover. Treat `docs/REQUIREMENTS.md` as the source of truth. The system is not complete merely because pages or models exist: workflows, permissions, persistence, tests, and documentation must work together.

## Before changing anything
1. Inspect the repository tree, Git status, existing README, dependencies, migrations, tests, and running app structure.
2. If an existing implementation exists, explain what is already present and preserve useful working code. Do not replace the repository wholesale.
3. Read all files in `docs/` before implementation. Resolve contradictions in favour of `REQUIREMENTS.md` and document the decision.
4. Work only on the current phase in `docs/IMPLEMENTATION_PLAN.md`. Do not start the frontend in Phase 0/1.
5. Never delete data, reset a database, rewrite Git history, or perform destructive refactors without asking first.

## Default technology choices
- Python 3.12+; FastAPI; SQLAlchemy 2.x; Alembic; Pydantic v2.
- SQLite for local development and tests; keep the configuration portable to PostgreSQL.
- React + Vite + TypeScript for the frontend, introduced only in its planned phase.
- `pytest` for backend tests; use a frontend test tool only if needed and document it.
- Secure password hashing (Argon2id preferred, or a well-maintained secure password-hashing library), short-lived JWT access tokens, and environment-based configuration.
- Local validated image uploads for development. Store file metadata in the database, not image bytes, unless there is a documented reason.
- Use UTC-aware timestamps and migrations for all schema changes.

## Actors and authorization
- **Visitor:** can browse/search only public, permitted report details; can register and sign in.
- **Registered User:** can manage their own profile, create and manage their own reports within allowed states, submit claims, and see only their own claims and notifications.
- **Staff Member:** can review reports, inspect restricted case details, decide claims, manage custody/status within policy, and record a verified handover.
- **Administrator:** can manage users/roles, categories, custody locations, report visibility/records, and view system summaries/audit records.

Use explicit role dependencies and resource-level ownership checks in the backend. Frontend route guards/buttons are only a usability layer, never the security boundary. A user must not be able to elevate their role by sending a request body field. Public registration must never allow selecting `staff` or `admin`.

## Required domain entities
At minimum, model these concepts and relationships consistently with `docs/DATABASE.md`:
`User`, `StaffProfile`, `Category`, `CustodyLocation`, `ItemReport`, `LostItem`, `FoundItem`, `ItemImage`, `MatchSuggestion`, `Claim`, `Return`, `Notification`, `ReportStatusHistory`, and `AuditLog`.

Subtype tables `LostItem` and `FoundItem` may be implemented as separate one-to-one tables or as well-documented typed fields on `ItemReport`; choose one approach and use it consistently. Do not silently omit match suggestions, custody locations, status history, or audit history. `Return` means a recorded handover, not simply a status label.

## Workflow and safety invariants
- Reports have a unique case/reference ID, creator, creation time, current status, and status history.
- Report creators may edit/close their own reports only when allowed by current status and policy. Authorized staff/admin may perform permitted moderation actions.
- Found-item custody location and sensitive finder/contact details are restricted to authorized case handlers; never expose precise restricted locations in public search/detail responses.
- Ownership evidence and internal review notes are private to the claimant and authorized staff/admin. Never return them in public report responses.
- Claims can be made only against eligible found reports/matches. Prevent duplicate active claims by the same claimant for the same report.
- Only Staff/Admin can approve, reject, or request more information on a claim. Record reviewer, decision time, and notes. A reviewer cannot approve their own claim.
- A report/item may become `Returned` only after an approved claim and a persisted return/handover confirmation. Keep the return record and status/audit history.
- Warn/confirm before `Returned`, `Disposed`, or `Archived`. Keep custody and status history. Archive/dispose only under an explicit policy-controlled workflow.
- Every potential match is a suggestion for human review, not proof of ownership. Explain matching signals and avoid automatically approving claims.
- Enforce the 30-minute inactive authenticated-session policy where feasible for the chosen token/session design; document the actual mechanism and limitations. Sign-out must invalidate the session/token where supported, not merely clear the UI.

## Engineering standards
- Keep API routes, Pydantic schemas, SQLAlchemy models, services/business rules, and configuration separated.
- Use input validation, pagination, safe error messages, structured logging, and indexes for common search/relationship fields.
- Validate uploaded file size and actual content/type; use generated filenames and prevent path traversal. Never trust the client filename or MIME type alone.
- Do not log passwords, tokens, ownership evidence, or unnecessary personal data. Do not commit `.env`, secrets, local databases, or uploaded private files.
- Use enums/constants for roles and statuses; centralize status transitions in service logic.
- Add tests for every important workflow, authorization rule, and invalid state transition.
- Keep explanations understandable to a student; avoid needless dependencies, speculative AI features, or decorative complexity.

## Required completion report for every phase
Report: (1) files changed, (2) what now works, (3) exact commands run, (4) actual test/build outcomes, (5) known gaps, (6) next phase. Distinguish implemented, tested, and merely planned. Never claim a feature or test works unless verified. Update docs when implementation decisions change.
