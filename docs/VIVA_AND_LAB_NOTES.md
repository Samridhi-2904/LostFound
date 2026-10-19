# Student Lab Guide and Viva Voce Preparation
## Lost and Found Management System

> **Document Status**: Aligned with verified implementation across Phases 0 through 11.  
> **Source of Truth**: [`docs/REQUIREMENTS.md`](REQUIREMENTS.md), [`AGENTS.md`](../AGENTS.md), and codebase test artifacts.

---

## 1. Project Overview & Motivation

### What is the project?
The **Lost and Found Management System** is a role-based web application designed for campus environments to solve the common problem of scattered lost property reports, fraudulent ownership claims, and lack of custody accountability.

### Why was this system built?
In most universities and large organizations, lost property management relies on disparate social media groups, physical pinboards, or informal security desks. This causes three critical vulnerabilities:
1. **Public Data Exposure**: Claimants often broadcast serial numbers, invoice photos, and personal contact numbers publicly, making them targets for scams or harassment.
2. **Fraudulent Claims**: Without a structured claim review workflow and private evidence submission, anyone can falsely claim an item.
3. **Broken Chain of Custody**: When items are handed over without verified recipient identity confirmation and audit logging, there is no accountability if items go missing from security lockers.

---

## 2. Implementation Status: Implemented vs. Tested vs. Out of Scope

In an academic viva or project defense, **never** claim an unverified or speculative feature works. Here is the verified reality of this repository:

| Feature Area | Implementation Status | Test Status | Technical Details |
| :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | ✅ Implemented | ✅ 12 Automated Tests (`test_auth.py`) | Argon2id password hashing, JWT Bearer tokens, in-memory token revocation, role escalation prevention. |
| **Domain Models & Migrations** | ✅ Implemented | ✅ 7 Automated Tests (`test_models.py`) | 13 SQLAlchemy 2.0 entities, Alembic migrations, foreign key cascades, unique constraints. |
| **Lost & Found Reporting** | ✅ Implemented | ✅ 6 Automated Tests (`test_reports.py`) | Case reference generator (`LR-` / `FR-`), category binding, subtype tables (`lost_items`, `found_items`). |
| **Privacy & Masking** | ✅ Implemented | ✅ 4 Automated Tests (`test_reports.py`, `test_claims.py`) | Public responses omit `contact_info_restricted` and restricted custody locker PINs. Evidence restricted to claimant and staff. |
| **Multi-field Search & Pagination** | ✅ Implemented | ✅ Automated Test (`test_phase5.py`) | Filter by query, category, report type, date range, location, and lifecycle status. |
| **Image Uploads & Storage** | ✅ Implemented | ✅ Automated Test (`test_phase5.py`) | File size validation (5MB max), MIME inspection, extension validation, path traversal prevention, served via static mount. |
| **Deterministic Advisory Matching**| ✅ Implemented | ✅ Automated Test (`test_phase5.py`) | Heuristic similarity scoring based on category, brand, colour, date proximity, and text overlap. Notifications dispatched. |
| **Claims & Staff Evaluation** | ✅ Implemented | ✅ 4 Automated Tests (`test_claims.py`) | Submit claim, block duplicate active claims, staff approve/reject/request-info, self-review prevention. |
| **Custody Handover & Returns** | ✅ Implemented | ✅ 5 Automated Tests (`test_phase7.py`) | Transition to `returned` only with approved claim and recorded recipient confirmation; custody transfers; archival/disposal. |
| **Admin Dashboard & Audit Logs** | ✅ Implemented | ✅ 2 Automated Tests (`test_phase8.py`) | Aggregate counters, user role promotion/demotion, admin self-lockout prevention, immutable audit trail. |
| **End-to-End Simulation** | ✅ Implemented | ✅ Automated Test (`test_e2e_journey.py`) | Exercises the full multi-role journey from registration to verified return. |
| **React + Vite Frontend** | ✅ Implemented | ✅ TypeScript & Production Build | React 19 + TypeScript, 7 responsive pages, glassmorphic UI, 30-min inactivity auto-logout. |
| *External Email/SMS Delivery* | ⚠️ Out of Scope / Simulated | N/A | Notifications are stored in-app in the `notifications` table; external email/SMS gateways are mockable interfaces. |
| *AI / Computer Vision Recognition*| ⚠️ Out of Scope | N/A | Matching uses explainable, deterministic heuristics. No opaque deep learning models are used. |

---

## 3. Architecture & Design Rationale

### Why FastAPI?
- **Asynchronous Performance**: Built on Starlette and Uvicorn with native Python `async`/`await` support.
- **Automatic DTO Validation**: Deep integration with Pydantic v2 ensures all incoming request bodies and outgoing responses are strictly validated against schemas.
- **Self-Documenting OpenAPI**: Interactive Swagger UI (`/docs`) and ReDoc (`/redoc`) generated automatically from code without external configuration.
- **Dependency Injection System**: Powerful `Depends()` mechanism used for database session lifecycle management and fine-grained role-based access control.

### Why SQLAlchemy 2.0 with Alembic?
- **Type-safe Mapped Columns**: Modern `Mapped[T]` and `mapped_column()` annotations provide static type safety across the entire data layer.
- **Portability**: Code developed on SQLite can seamlessly transition to PostgreSQL or MySQL in production simply by altering the `DATABASE_URL` environment variable.
- **Controlled Migrations**: Schema alterations are version-controlled in Git using Alembic revisions rather than running destructive `drop_all()` scripts.

### Why React 19 + Vite + Vanilla CSS?
- **Vite Build Speed**: Instant hot module replacement (HMR) and fast Rollup-based production bundling.
- **Modern Vanilla CSS Design System**: Uses CSS custom properties (variables) for design tokens, responsive fluid typography, and glassmorphism without heavy external CSS frameworks.
- **Component Reusability**: Modals, badges, navigation headers, and metric cards are partitioned into reusable components.

### Why Argon2id for Password Hashing?
- Won the Password Hashing Competition (PHC).
- Provides hybrid resistance against both GPU-based brute-force attacks and side-channel cache attacks by utilizing memory-hard functions. Far superior to legacy MD5, SHA-1, or plain SHA-256.

---

## 4. Key Invariants & Security Guardrails

### 1. The "Return Handover" Invariant
An item report cannot transition to the `returned` lifecycle status via a simple status patch.
- **Requirement**: A report can only become `returned` when:
  1. An active claim exists on that found report.
  2. The claim has been marked `approved` by an authorized staff member or admin.
  3. A physical handover confirmation is recorded (`recipient_confirmation`, `condition_of_item`, `notes`).
- **Enforcement**: [`backend/app/services/return_service.py`](backend/app/services/return_service.py) enforces this transactionally and persists a `Return` entity record.

### 2. Self-Review Prevention
- **Invariant**: A staff member who reported a lost item or found item cannot approve or reject their own ownership claim.
- **Enforcement**: [`backend/app/services/claim_service.py`](backend/app/services/claim_service.py) verifies `claim.claimant_id != current_user.user_id` before processing decisions.

### 3. Masking & Multi-Tenant Privacy
- **Public Views**: `GET /api/v1/reports` returns `ReportPublicResponse`. Sensitive fields (`contact_info_restricted`, finder contact info, custody locker PINs) are omitted from the schema.
- **Claim Evidence**: Ownership evidence submitted during a claim is only visible to the user who filed it and staff/admin users.

### 4. Admin Self-Lockout Prevention
- **Invariant**: An administrator cannot demote their own account to `user` or deactivate their own account, preventing accidental administrative lockout.

### 5. Inactivity Session Invalidation (NFR-03)
- The frontend tracks user mouse movement, keyboard strokes, and touches. If 30 minutes pass without activity, the session is cleared, the JWT token is purged from storage, and the user is redirected to the login screen with a warning.

---

## 5. Domain Entities (The 13 Core Tables)

```text
  ┌───────────────┐         1:N         ┌──────────────────┐
  │     User      ├────────────────────►│    ItemReport    │
  └───────┬───────┘                     └────────┬─────────┘
          │ 1:1                                  │
          ▼                                      ├──► 1:1 LostItem
  ┌───────────────┐                              ├──► 1:1 FoundItem
  │ StaffProfile  │                              ├──► 1:N ItemImage
  └───────────────┘                              ├──► 1:N MatchSuggestion
                                                 ├──► 1:N Claim ────► 1:1 Return
                                                 ├──► 1:N ReportStatusHistory
                                                 └──► 1:N Notification
```

1. **`User`**: System actors (Visitor, Registered User, Staff, Admin) with Argon2id credentials.
2. **`StaffProfile`**: 1-to-1 extension holding department and employee ID for staff users.
3. **`Category`**: Configurable item taxonomies (Electronics, Wallets, Books, etc.).
4. **`CustodyLocation`**: Physical campus storage facilities (Vaults, Desks) with restricted access details.
5. **`ItemReport`**: Central case report containing case reference (`LR-...` / `FR-...`), dates, lifecycle status, and moderation status.
6. **`LostItem`**: Subtype table for lost items (last seen location, reward offered).
7. **`FoundItem`**: Subtype table for found items (custody location foreign key, storage shelf reference).
8. **`ItemImage`**: Metadata for uploaded photos (filename, file path, MIME type, size).
9. **`MatchSuggestion`**: Advisory candidate pairing between a lost report and found report with score and JSON explanation.
10. **`Claim`**: Formal assertion of item ownership with private evidence submitted by a registered user.
11. **`Return`**: Official handover confirmation documenting identity verification and item physical condition.
12. **`ReportStatusHistory`**: State transition audit recording old status, new status, modifier, and reason.
13. **`AuditLog`**: Security and administrative event log (role updates, claim decisions, custody transfers).

---

## 6. Top 25 Viva Voce Questions & Answers

### Architecture & Backend Questions

#### Q1: What design pattern does the backend follow?
**Answer**: It follows a layered architectural pattern with strict separation of concerns:
- **Presentation Layer (`api/v1/`)**: FastAPI route handlers that receive HTTP requests and return DTO responses.
- **Validation Layer (`schemas/`)**: Pydantic v2 models that validate incoming payloads and serialize output.
- **Service Layer (`services/`)**: Pure business logic, state machines, and access invariant enforcement.
- **Data Layer (`models/` & `db/`)**: Declarative SQLAlchemy ORM entities and database session lifecycle.

#### Q2: What is the difference between a Pydantic Schema and a SQLAlchemy Model?
**Answer**:
- A **SQLAlchemy Model** (e.g., `ItemReport` in `models/report.py`) defines the database table schema, columns, primary keys, foreign keys, and relationships stored on disk.
- A **Pydantic Schema** (e.g., `ReportCreate`, `ReportPublicResponse` in `schemas/report.py`) defines the structure of data sent over the network (DTOs), performing type conversion, data validation, and preventing the leakage of private database columns to the client.

#### Q3: How does FastAPI's Dependency Injection work in this project?
**Answer**: FastAPI uses `Depends()`. We use it in two key ways:
1. **Database Session**: `get_db` yields a SQLAlchemy session per request and guarantees cleanup/close in a `finally` block.
2. **Authentication & Authorization**: `get_current_user`, `require_staff`, and `require_admin` inspect the incoming `Authorization: Bearer <token>` header, decode the JWT, verify user active status, and raise HTTP 401 or 403 before route execution.

#### Q4: Why use Argon2id over bcrypt or SHA-256?
**Answer**: SHA-256 is a fast cryptographic digest designed for integrity, making it vulnerable to billions of guesses per second on modern GPUs. `bcrypt` is slow but vulnerable to FPGA attacks due to low memory requirements. `Argon2id` is memory-hard, highly resistant to GPU/ASIC attacks, and resists side-channel attacks by combining data-dependent and data-independent memory addressing.

#### Q5: How is token invalidation handled on logout?
**Answer**: While JWTs are stateless by default, our system includes a server-side revocation mechanism in [`backend/app/core/security.py`](backend/app/core/security.py). Each token is issued with a unique `jti` (JWT ID). When a user calls `POST /api/v1/auth/logout`, the `jti` is added to a revoked token registry. On subsequent requests, the dependency checks if the token's `jti` has been revoked and rejects it with HTTP 401.

#### Q6: How are database migrations managed?
**Answer**: Using **Alembic**. Instead of deleting and recreating the database, Alembic tracks schema changes through revision files (e.g., `c189974534d9_initial_schema.py`). Commands like `alembic upgrade head` apply incremental DDL changes (`CREATE TABLE`, `ALTER TABLE`) safely without data loss.

---

### Domain & Business Logic Questions

#### Q7: Why is a Match Suggestion not an automatic claim approval?
**Answer**: A match suggestion is based on heuristic signals (similar item name, category, colour, date proximity). Multiple people might lose a "Silver Dell Laptop" on the same day. Treating a match as automatic proof of ownership would enable theft. It is strictly an advisory suggestion for human review.

#### Q8: What prevents duplicate claims on the same report?
**Answer**: In `ClaimService.create_claim`, the system queries existing claims for that `(report_id, claimant_id)` tuple. If a claim already exists in `pending`, `more_information_requested`, or `approved` state, the request is rejected with HTTP 400.

#### Q9: What happens when staff requests more information on a claim?
**Answer**: The claim transitions to `more_information_requested`. The claimant is notified, and on their profile page, they can view the staff reviewer's note and submit additional evidence (e.g., serial number screenshot, purchase invoice). Once submitted, the claim returns to `pending` review.

#### Q10: What are the lifecycle states of an ItemReport?
**Answer**:
- `open`: Newly created and actively searching/held.
- `matched`: Advisory match detected with another report.
- `claimed`: An active claim has been filed or approved.
- `returned`: Verified in-person handover has been executed.
- `archived`: Older report closed under retention policy.
- `disposed`: Unclaimed found item disposed/donated under formal policy with justification.

#### Q11: What is the difference between `lifecycle_status` and `moderation_status`?
**Answer**:
- `moderation_status` (`pending_review`, `verified`, `rejected`) controls whether a report has been vetted by security staff and is visible in public search.
- `lifecycle_status` (`open`, `claimed`, `returned`, `archived`, `disposed`) tracks where the physical item or case sits in the operational resolution process.

#### Q12: How does the system ensure auditability?
**Answer**: Every significant action writes to one of two audit tables:
1. `ReportStatusHistory`: Tracks every state transition of a report with timestamp, previous state, new state, user ID, and reason.
2. `AuditLog`: System-wide immutable security log recording action name (e.g. `USER_ROLE_PROMOTED`, `ITEM_RETURNED`, `CUSTODY_TRANSFERRED`), IP address, user agent, and contextual JSON details.

---

### Frontend & Security Questions

#### Q13: How does the frontend protect against Cross-Site Scripting (XSS)?
**Answer**: React automatically escapes strings rendered inside JSX expressions `{...}`, preventing malicious injected scripts from executing. Additionally, user inputs are strictly typed and sanitized on both client and server.

#### Q14: How does the frontend handle token persistence and expiration?
**Answer**: Tokens are stored in browser `localStorage`. Axios request interceptors automatically attach the `Authorization: Bearer <token>` header to all outgoing requests. A response interceptor catches HTTP 401 Unauthorized errors and automatically clears credentials and redirects the user to `/login`.

#### Q15: How is the 30-minute inactivity auto-logout implemented?
**Answer**: In `AuthContext.tsx`, an inactivity timer is established. DOM event listeners (`mousemove`, `keydown`, `click`, `scroll`) reset the timer upon any user interaction. If no event fires within 30 minutes (1,800,000 ms), `logout()` is automatically triggered, clearing session state and revoking the token.

#### Q16: How is file upload security handled for report images?
**Answer**: Image uploads undergo three layers of validation in `report_service.py`:
1. **Size check**: Maximum 5 MB per file.
2. **Extension check**: Must be `.jpg`, `.jpeg`, `.png`, or `.webp`.
3. **MIME type inspection**: Validated against allowed image MIME types.
4. **Filename sanitization**: The original user filename is discarded and replaced with a cryptographic UUID to prevent path traversal attacks (`../../etc/passwd`).

---

## 7. Step-by-Step Live Demo Script for Evaluators

When presenting the project to an examiner or instructor, execute this 5-minute walkthrough:

1. **Show the System Health & API Docs**:
   - Open `http://127.0.0.1:8000/docs` in the browser.
   - Point out versioned `/api/v1` routers, interactive Swagger schemas, and role dependency annotations.

2. **Public Visitor Search**:
   - Open `http://localhost:5173/search`.
   - Search for "Dell" without logging in.
   - Click on the found Dell XPS laptop report.
   - **Point out to the evaluator**: Sensitive details (exact locker PIN, finder phone number) are hidden and replaced with "Protected (Staff Only)".

3. **Student Alice Signs In & Checks Matches**:
   - Sign in as `alice@campus.edu` / `StudentPass123!`.
   - Visit Alice's Profile page.
   - Show the advisory match suggestion with **88% confidence score** and explainable match signals (category, brand, colour match).
   - Click **Claim Item**, enter evidence ("My laptop has serial number DL-984210 and Ubuntu sticker"), and submit.

4. **Staff Mike Moderates & Approves Handover**:
   - Sign in as `staff@campus.edu` / `StaffSecret123!`.
   - Go to **Staff Dashboard**.
   - Show the **Claims Review Queue**.
   - Show that self-review is prevented.
   - Click **Approve Claim** with reviewer notes.
   - Click **Record Return Handover**, enter Alice's student ID card verification details, and submit.
   - Show that the item status updates to **Returned**.

5. **Admin System Oversight**:
   - Sign in as `admin@campus.edu` / `AdminSecret123!`.
   - Go to **Staff & Admin Dashboard**.
   - View real-time system metrics (Total Reports, Returns, Lifecycle Distribution).
   - View the **User Management Directory** and demonstrate role promotion.
   - Open **System Audit Logs** to show the immutable trace of every single action taken during the demo.

6. **Run Automated Test Suite**:
   - Run `pytest backend/tests -v` in terminal.
   - Point to **42 passed tests** proving all invariants and safety rules are validated by automated code.
