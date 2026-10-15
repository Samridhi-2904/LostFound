# Testing Strategy

Use `pytest` with an isolated temporary/test database and deterministic fixtures. Never run destructive tests against a developer's real database. Tests must exercise backend APIs directly so frontend hiding cannot mask authorization bugs.

## Foundation and schema
- Health endpoint returns expected response.
- Fresh Alembic upgrade works; relationships, constraints, enums, and indexes are valid.
- Restart/reopen preserves persisted data; tests do not share state unexpectedly.

## Authentication and sessions
- Registration success, required-field validation, duplicate/normalized email, and privileged-role escalation attempt.
- Password is hashed and never returned; valid/invalid login; inactive user.
- Unauthenticated protected requests; expiry/inactivity behaviour; logout/revocation behaviour supported by actual design.
- Successful/failed sign-in events are audited without passwords or tokens.

## Roles, ownership, and privacy
- Visitor can only read public permitted fields.
- User cannot edit/close another user's report, read another user's claim/evidence/notifications, change roles, or call staff/admin routes.
- Staff can perform allowed review/custody tasks but not admin-only actions.
- Admin can perform authorized management actions.
- Public schemas never contain ownership evidence, internal review notes, precise custody address, restricted contact details, or password hashes.
- Users cannot review their own claims; direct API calls cannot bypass checks.

## Reports and statuses
- Lost/found creation, required fields, unique case reference, optional fields/images, creator metadata.
- Edit/close only in allowed states; status/history row written for every status transition.
- Combined keyword/type/category/date/location/colour/status filters and pagination; stable ordering and page-size cap.
- Invalid or forbidden status transitions rejected; archive/disposal require role, confirmation-compatible workflow, and reason.

## Uploads and matching
- Reject oversize files, fake image extensions/content, unsafe names/path traversal, and unsupported content types.
- Authorized image retrieval and private storage behaviour.
- Match suggestion only links one lost and one found report; pair deduplication; score/reasons persisted; dismissed/reviewed states respected.
- Matching is advisory; never automatically approves a claim. Notification content avoids private information.

## Claims and returns
- Claim only on eligible found report; reject claim on lost/ineligible report.
- Prevent duplicate active claims; test concurrent attempts where feasible.
- Evidence readable only by claimant and authorized staff/admin.
- Staff/admin decisions store reviewer, timestamp, status, and notes; unauthorized decisions fail.
- Return requires approved claim and recorded handover; one return per claim; status/history/audit writes are consistent and transactional.

## Notifications and audit
- Expected notifications created and read state persists.
- User can only read/mark own notifications.
- Audit role changes, moderation, claim decisions, custody/visibility changes, returns, and admin actions; no secrets/private evidence in audit payloads.
- Audit listing is admin-only; case history is limited to authorized case handlers.

## Frontend quality (after frontend phases)
- Production build and any configured frontend tests pass.
- Manually verify visitor/user/staff/admin navigation and protected pages.
- Verify field-level errors, loading/error/empty states, filter combinations, confirmation dialogs, keyboard/accessibility basics, and responsive width down to 360px.
- Verify no private fields leak in browser network responses, not just that they are hidden visually.

## End-to-end acceptance flow
1. Admin provisions a staff account; visitor registers as an ordinary user.
2. User A creates a found report with custody details; public view shows only permitted approximate details.
3. Staff verifies the report; report and audit/status history update.
4. User B creates a lost report; a persisted potential match may be generated and privacy-safe notifications are delivered.
5. User B submits private ownership evidence against the eligible found report; another user cannot view it.
6. Staff requests more information or approves/rejects the claim; decision metadata is persisted.
7. After approval only, staff records handover; Return, Returned status, status history, and audit record are persisted.
8. Verify dashboard counts, notification ownership, permission denials, and persistence after restart.

## Performance and browser checks
- Treat 3-second 95th-percentile search/page response, 5-second report submission, 100 concurrent users, and 60-second match generation as targets to measure, not assumptions. Record test environment and method.
- Cross-browser checks target current and previous major Chrome, Edge, Firefox, and Safari versions when environments are available. Clearly list what was actually tested.

Only describe tests as passing when commands were run and results observed.
