# Implementation Plan

Implement one phase at a time. Do not jump ahead or mark a phase complete just because files were generated. First inspect the actual repository and adapt this plan without discarding useful work. Keep the frontend out of Phases 0–8.

## Phase 0 — Repository inspection and plan
- Inspect tree, Git status, Python/Node versions if present, dependencies, existing code, tests, migrations, and README.
- Read `AGENTS.md` and every document in `docs/`.
- Report existing functionality, risks, and exact proposed changes before editing. Preserve working code; ask before destructive actions.
- **Exit check:** written repo assessment and agreed phase scope; no unnecessary code changes.

## Phase 1 — Backend foundation only
- Create/complete FastAPI app, settings, environment loading, `/health`, SQLAlchemy engine/session, base model setup, requirements, `.env.example`, and basic pytest smoke test.
- Add clean package structure and CORS configuration from settings; do not create the frontend yet.
- `/health` should return `{"status":"ok"}` when the app is healthy.
- **Exit check:** app starts using documented commands; `/health` and test pass; secrets are not hard-coded; README commands reflect actual setup.

## Phase 2 — Domain models and migrations
- Implement all required entities/relationships from `DATABASE.md`: User, StaffProfile, Category, CustodyLocation, ItemReport, subtype design for LostItem/FoundItem, ItemImage, MatchSuggestion, Claim, Return, Notification, ReportStatusHistory, AuditLog.
- Implement enums/constraints/indexes and first Alembic migration. Choose and document a consistent split between moderation and lifecycle status.
- **Exit check:** migration upgrades a fresh DB and schema/model tests pass; do not wipe an existing DB without approval.

## Phase 3 — Authentication and authorization
- Registration, login, current-user endpoint, profile update, logout/revocation strategy, secure password hashing, role dependencies, owner checks, and 30-minute inactivity policy to the extent supported by selected session design.
- Ensure public registration cannot assign staff/admin roles; provide a documented safe way to provision the first administrator.
- **Exit check:** tests cover duplicate email, password hashing, invalid credentials, inactive account, token/session expiry/revocation behaviour, and role escalation attempts.

## Phase 4 — Categories and report workflows
- Public category listing; admin category management; create/edit/close lost/found reports; unique case reference; moderation workflow; status history; field validation and ownership checks.
- Implement safe public/owner/staff/admin DTOs. Found report must capture custody location, while precise location/contact details remain restricted.
- **Exit check:** tests cover all report types, required fields, case ID, edit/close permissions, invalid status transitions, privacy boundaries, and persistence.

## Phase 5 — Search, image uploads, and matching
- Implement combined keyword/type/category/date/location/colour/status filters and pagination.
- Validate upload size and actual content/type; generate safe filenames; store metadata and protect private files.
- Implement deterministic matching across category, description/attributes, dates, and location; persist MatchSuggestion score/reasons/state; trigger privacy-safe in-app notifications. No automatic claim approval.
- **Exit check:** tests for combined filters, upload validation, private image access, match pair types/duplicate pair, explainable match reasons, and notifications.

## Phase 6 — Claims and decisions
- Submit claim only for eligible found report; keep ownership evidence private; prevent duplicate active claims; staff/admin may approve, reject, or request more information; store decision maker/time/reason; disallow self-review.
- **Exit check:** tests cover claimant access, evidence privacy, duplicate claims, staff/admin permissions, reviewer metadata, and invalid claim transitions.

## Phase 7 — Custody, returns, notifications, and audit
- Record custody changes; persist return/handover only after approved claim; write Return, lifecycle status, ReportStatusHistory, and AuditLog consistently in a transaction; confirm archive/disposal and require reason; persist notification read state.
- Audit sign-in success/failure, role changes, and administrative changes without storing credentials/tokens or full sensitive payloads.
- **Exit check:** tests prove Returned cannot be reached without an approved claim and saved handover; audit/history persist; users cannot read others' notifications/evidence.

## Phase 8 — Admin and requirement coverage
- Admin user/role management, category/custody management, report moderation, audit view, and dashboard counts for Open, Matched, Claimed, Returned, Archived, and Disposed.
- Build an FR-01–FR-25 traceability table: implemented path/test, or explicit known gap and reason for every FR. Add performance/privacy/security notes for NFRs.
- **Exit check:** all requirements have a verified status; role checks and dashboard counting rules are tested.

## Phase 9 — Frontend foundation
- Introduce React + Vite + TypeScript, routing, typed API client, environment config, shared layout, public home/search, login/register, and accessible responsive base styles.
- **Exit check:** install/build works from clean setup; API errors and auth state are handled without exposing secrets.

## Phase 10 — Frontend workflows
- Report creation/details/edit/close, images, claims/evidence, notifications, match suggestions, staff report/claim/custody workflows, admin screens, and dashboard.
- Include loading/error/empty states, field-level validation, confirmation for sensitive actions, and layouts down to 360px. Frontend guards do not replace backend checks.
- **Exit check:** manually exercise all major roles and primary flow; build passes.

## Phase 11 — Final verification and student handover
- Run backend tests, frontend build/tests, migrations on a fresh test DB, and a documented end-to-end flow.
- Update README with verified setup, environment variables, migration/test commands, demo accounts only if safe and clearly development-only, limitations, and troubleshooting.
- Update Lab/Viva notes to distinguish designed, implemented, and tested features.
- **Exit check:** provide a concise evidence-based completion report and list remaining gaps. Never claim production readiness or performance compliance without evidence.

## Required phase report
For each phase, state files changed, working behaviour, commands run, exact pass/fail results, unverified items, known limitations, and next phase. Stop and fix failures before proceeding unless the user explicitly asks to defer them.
