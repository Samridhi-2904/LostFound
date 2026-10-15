# Requirements and SRS Traceability

## 1. Purpose and scope
The Lost and Found Management System centralizes lost/found item reports, public-safe searching, potential matching, claim review, custody tracking, and documented item handover. Staff decisions and history must be traceable. The SRS is the functional source of truth for implementation.

## 2. Actors
1. **Visitor (unauthenticated):** browse/search public report summaries and permitted details; register/sign in.
2. **Registered User:** maintain own profile; create, edit, and close own eligible reports; submit claims with evidence; view own reports, claims, and notifications.
3. **Staff Member:** verify/reject reports, access restricted case details, review claims, request more information, approve/reject claims, maintain custody/status records, and record returns.
4. **Administrator:** manage users and roles, categories, custody locations, report records/visibility, system summaries, and authorized audit records.

## 3. Functional requirements
### Identity and accounts
- **FR-01 Registration:** validate required fields and unique email; public registration creates only the ordinary registered-user role.
- **FR-02 Authentication:** sign in with valid credentials; return safe errors; hash passwords with a modern password-hashing algorithm.
- **FR-03 Roles/permissions:** enforce Visitor, Registered User, Staff, and Administrator permissions on the server for every protected action.
- **FR-04 Sign-out/session:** sign out invalidates the applicable session/token; authenticated inactivity expires after 30 minutes where supported by the implemented auth design. Explain limitations of stateless JWTs if used.

### Lost reports
- **FR-05 Create lost report:** require item name, category, description, date lost, approximate location, and contact preference. Colour, brand, distinguishing marks, and one or more images are optional.
- **FR-06 Reference and status:** assign a unique case/reference ID, creation timestamp, and initial Open/pending-review state according to the moderation design.
- **FR-07 Edit/close:** creator can edit or close their own report only while allowed by policy; preserve status history.
- **FR-08 Images:** validate size and actual image type; safely store image files and metadata; allow authorized removal where policy permits.

### Found reports and custody
- **FR-09 Create found report:** require category, description, date found, approximate public location, custody location, and appropriate finder/staff contact details.
- **FR-10 Restricted details:** precise custody location and sensitive contact/finder details are visible only to authorized case handlers, not visitors/public search results.
- **FR-11 Custody/status:** track current custody location and item/report status. Preserve prior custody/status changes in history.

### Search and matching
- **FR-12 Search:** support keyword, category, date range, location, colour, and report status filters, plus lost/found type. Filters must combine correctly and support pagination.
- **FR-13 Public results:** display useful summary details including approximate date/location and only fields permitted for the current actor.
- **FR-14 Potential matches:** compare lost/found records using available category, descriptive attributes, dates, and locations. Store a MatchSuggestion with the matched reports, score/reasons, state, and timestamps. A deterministic, documented baseline is sufficient; do not require an external AI service.
- **FR-15 Notifications:** notify relevant registered users/staff about potential matches according to preferences and permissions. Persist in-app notifications; avoid leaking private details in notification text.

### Claims, decisions, and returns
- **FR-16 Claim submission:** a signed-in user may submit a claim for an eligible found report/potential match and provide ownership evidence that is private by default.
- **FR-17 Claim review:** staff/admin can approve, reject, or request more information. Record decision maker, decision date/time, notes, and claim status.
- **FR-18 Return eligibility:** a return cannot be recorded unless a claim has been approved.
- **FR-19 Handover confirmation:** record the return/handover date/time, responsible staff member, recipient/confirmation details appropriate to the privacy policy, and optional notes/condition.
- **FR-20 Auditability:** preserve the claim, decision, return, status, and relevant custody history; do not erase historical records when closing or archiving.

### Administration and audit
- **FR-21 Categories/custody:** administrator can create/update/deactivate categories and manage custody locations. Do not hard-delete records referenced by reports.
- **FR-22 Moderation/retention:** staff/admin can review reports, change status, and archive/dispose only according to an explicit policy. Confirm sensitive/destructive transitions.
- **FR-23 Dashboard:** show counts for Open, Matched, Claimed, Returned, Archived, and Disposed reports/items; define counting rules and use consistent statuses.
- **FR-24 Audit log:** record important changes to status, ownership/claim decisions, custody, visibility, role assignments, sign-in success/failure, and administrative actions. Restrict audit access to authorized administrators (staff may receive only case-relevant history).
- **FR-25 Authorization/privacy:** users cannot modify another user's profile or report; enforce backend ownership and role rules; restrict private evidence and sensitive case details.

## 4. Status model
Use a clear canonical status model and document any separate moderation/claim statuses. The item/report lifecycle must represent at least: `Open`, `Matched`, `Claimed`, `Returned`, `Archived`, and `Disposed`. Moderation may additionally use `PendingReview`, `Verified`, and `Rejected`; report closure may be represented as a separate state/action if needed. Claim states: `Pending`, `MoreInformationRequested`, `Approved`, `Rejected`, `Cancelled`. Match suggestion states may include `New`, `Reviewed`, `Dismissed`, and `Confirmed`.

Do not use a single overloaded status field to mix report moderation, claim decision, and physical custody. If separate `moderation_status`, `lifecycle_status`, and claim/match statuses are used, document transitions and map dashboard counts explicitly. Status transitions must be validated in backend services, not freely set by arbitrary clients.

Minimum safety transitions:
- `Returned` requires an approved claim plus persisted handover confirmation.
- `Disposed` and `Archived` require authorized role, confirmation, policy-compliant reason, and history.
- A potential match never proves ownership and never automatically approves a claim.

## 5. Non-functional requirements
- **Performance:** aim for 95% of normal pages/search requests within 3 seconds; report submission/reference creation within 5 seconds; support a design target of 100 concurrent users; produce match suggestions within 60 seconds. Measure where feasible and document local test limitations.
- **Security:** HTTPS in deployment; modern salted password hashing; role and ownership authorization; private evidence; secure upload handling; no secrets in source control; log successful/failed sign-ins, role changes, and admin changes without logging credentials or tokens.
- **Session:** inactive authenticated session expires after 30 minutes; sign-out invalidates authentication as supported by the selected implementation.
- **Privacy:** public users cannot see ownership evidence, precise custody locations, or restricted contact details.
- **Quality:** responsive down to 360px; field-level validation messages; persistence after refresh/restart; modular code; setup documentation; target current and previous major Chrome, Edge, Firefox, and Safari versions.
- **Availability:** target 99% during operating hours excluding planned maintenance; this is a target, not a claim about local development.

## 6. Data and business rules
- Every report has one creator, unique case ID, creation timestamp, category (unless the documented design explicitly allows a controlled uncategorized state), type, status, and history.
- Report creators edit/close only their own reports in eligible states; staff/admin can act only within their authorization.
- A found item remains associated with its current custody location until a recorded transfer, return, disposal, or archive action changes it.
- Claims require sufficient non-public ownership evidence and a staff/admin decision.
- Personal contact details and restricted custody information are shared only with authorized case handlers.
- Use UTC-aware timestamps, foreign keys, indexes, and migrations.

## 7. Out of scope for the first version
No payments, live chat, native mobile app, mandatory email/SMS provider, or external AI/image-recognition service. In-app notifications and explainable rule-based matching are in scope. Any deferral must be listed as a known limitation, not silently treated as complete.

## 8. Acceptance checklist
- All four actors and backend permissions exist.
- All FR-01–FR-25 requirements are implemented or individually marked as a known gap with reason.
- Required domain entities include `MatchSuggestion`, `AuditLog`, `CustodyLocation`, and `ReportStatusHistory`.
- Public responses never expose private claim evidence or precise restricted custody/contact data.
- Returned cannot occur without an approved claim and a saved handover record.
- Search filters combine correctly; notifications and match suggestions persist.
- Tests cover authorization, privacy, invalid transitions, persistence, and the primary end-to-end workflow.
