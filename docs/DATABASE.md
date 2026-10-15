# Database Design

Use SQLAlchemy 2.x models, explicit foreign keys/constraints, UTC-aware timestamps, useful indexes, and Alembic migrations. Never return password hashes or private evidence from general response schemas.

## Entity inventory

### User
`user_id` PK; `full_name`; normalized unique `email`; optional `phone`; `password_hash`; `role` enum (`user`, `staff`, `admin`); `is_active`; `created_at`; `updated_at`; optional `last_login_at`. Public registration must not accept a privileged role.

### StaffProfile
`staff_id` PK; unique `user_id` FK to User; `department`; unique `employee_code` where applicable; `created_at`. Staff membership must be provisioned by an administrator or trusted seed process.

### Category
`category_id` PK; unique `category_name`; optional `description`; `is_active`; timestamps. Prefer deactivation to deletion if reports reference it.

### CustodyLocation
`custody_location_id` PK; `name`; optional `description`; restricted address/location details; `is_active`; created/updated timestamps. Public DTOs must not serialize restricted address details.

### ItemReport
`report_id` PK; unique human-readable `case_reference`; `created_by` FK User; `category_id` FK Category; `report_type` enum (`lost`, `found`); `item_name`; `description`; `date_reported`; `date_lost_found`; approximate public `location`; optional `colour`, `brand`, `distinguishing_marks`; contact preference; optional restricted contact fields; `moderation_status`; `lifecycle_status`; `visibility`; optional `verified_by` FK User and `verified_at`; timestamps. Keep moderation status separate from item lifecycle status.

### LostItem and FoundItem
Choose one consistent design:
- Preferred for normalized schema: `LostItem.report_id` PK/FK ItemReport plus `last_seen_location` and any lost-only fields; `FoundItem.report_id` PK/FK ItemReport plus `found_location` and `custody_location_id` FK CustodyLocation and found-only fields.
- If the repository already uses a single-table design, typed optional fields on ItemReport are acceptable; document and test type-specific validation. Do not maintain duplicate sources of truth.

### ItemImage
`image_id` PK; `report_id` FK; generated safe storage key/path; optional display filename (sanitized); verified content type; file size; `is_primary`; `uploaded_at`. Avoid exposing filesystem paths. Ensure deleting a report follows a documented retention policy.

### MatchSuggestion
`match_id` PK; `lost_report_id` FK ItemReport; `found_report_id` FK ItemReport; deterministic `score`; structured or text `match_reasons`; `status` (`new`, `reviewed`, `dismissed`, `confirmed`); `created_at`; `updated_at`; optional `reviewed_by` FK User and `reviewed_at`. Add a uniqueness constraint for a report pair and validate the pair types are lost/found. Matching is advisory only.

### Claim
`claim_id` PK; `report_id` FK ItemReport (must be eligible found report); `claimed_by` FK User; private `ownership_evidence` or private evidence reference; `status`; `submitted_at`; optional `reviewed_by` FK User; `reviewed_at`; `review_notes` private; optional `decision_reason`; timestamps. Add constraints/indexes supporting duplicate active-claim prevention. If a partial unique index is not portable to SQLite/PostgreSQL, enforce duplicate-active rules transactionally in service logic and test concurrency-sensitive behavior as far as practical.

### Return
`return_id` PK; unique `claim_id` FK Claim; `recorded_by` FK User (authorized staff/admin); `returned_at`; recipient confirmation/details appropriate to privacy policy; optional `condition_of_item`; optional `notes`; created timestamp. Create this row before/within the same transaction as transitioning lifecycle status to `Returned`.

### Notification
`notification_id` PK; `user_id` FK User; `title`; privacy-safe `message`; `type`; optional related report/claim/match references; `is_read`; `created_at`; `read_at`. Users may read/update only their own notifications.

### ReportStatusHistory
`history_id` PK; `report_id` FK ItemReport; previous/new lifecycle and/or moderation status; `changed_by` FK User nullable only for a clearly identified system action; `reason`; `changed_at`. Store custody transitions here or in a dedicated custody history table; at minimum the previous and current custody location must be auditable.

### AuditLog
`audit_id` PK; optional `actor_user_id` FK User; `action`; `entity_type`; `entity_id`; timestamp; safe structured change summary; optional request/correlation ID. Do not store passwords, tokens, full ownership evidence, or unnecessary sensitive payloads. Restrict general audit browsing to admins; expose only case-relevant events to authorized staff.

## Relationships
- User 1:M ItemReport as creator.
- Category 1:M ItemReport.
- ItemReport 1:M ItemImage, 1:M Claim, and 1:M ReportStatusHistory.
- LostItem/FoundItem each 1:0..1 ItemReport depending on selected subtype design.
- FoundItem references one current CustodyLocation; a location may be referenced by many found items.
- MatchSuggestion references one lost and one found report.
- User 1:M Claim as claimant and 1:M Claim as reviewer.
- Claim 1:0..1 Return.
- User 1:M Notification; User 1:0..1 StaffProfile.
- AuditLog references the acting user where available and identifies the affected entity.

## Status definitions
- Moderation: `pending_review`, `verified`, `rejected`.
- Lifecycle: `open`, `matched`, `claimed`, `returned`, `archived`, `disposed`, with any extra closure state documented and mapped.
- Claim: `pending`, `more_information_requested`, `approved`, `rejected`, `cancelled`.
- Match: `new`, `reviewed`, `dismissed`, `confirmed`.

Use Python enums or constrained values. Do not let arbitrary client-provided status values bypass a transition service. Define how one report can have multiple claims without letting one rejected claim incorrectly close the report.

## Privacy and integrity
- Use separate public, owner, and staff/admin response schemas.
- Never serialize private evidence, password hashes, restricted contact information, or precise custody address in public schemas.
- Index normalized email, case reference, report type/status, category, relevant dates, and foreign keys used in search/joins.
- Add constraints for unique case reference, valid report type, valid relationships, and one return per claim.
- Use migrations, not ad hoc production schema creation. Tests must use an isolated database.
