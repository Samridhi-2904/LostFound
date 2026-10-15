# API Plan

Prefix application endpoints with `/api/v1`; health may remain `GET /health`. Use Pydantic request/response schemas, pagination, consistent errors, and server-side permission/workflow checks. This is a planned contract: align names with existing repository conventions after inspection and update this document if implementation differs.

## Health and identity
- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout` (must invalidate the applicable session/token where supported)
- `GET /api/v1/auth/me`
- `PATCH /api/v1/users/me`

## Categories and custody locations
- Public: `GET /api/v1/categories` (active categories only)
- Admin: `POST /api/v1/admin/categories`, `PATCH /api/v1/admin/categories/{id}`
- Admin: `GET /api/v1/admin/custody-locations`, `POST /api/v1/admin/custody-locations`, `PATCH /api/v1/admin/custody-locations/{id}`

## Reports and images
- `GET /api/v1/reports` supports `q`, `report_type`, `category_id`, date range, approximate `location`, `colour`, lifecycle/moderation status where safe, `page`, and `page_size`.
- `GET /api/v1/reports/{id}` returns actor-appropriate fields only.
- Authenticated: `POST /api/v1/reports`, `PATCH /api/v1/reports/{id}`, `POST /api/v1/reports/{id}/close`.
- Staff/admin: `GET /api/v1/staff/reports/pending`, `POST /api/v1/staff/reports/{id}/verify`, `POST /api/v1/staff/reports/{id}/reject`, `PATCH /api/v1/staff/reports/{id}/status`.
- Images: `POST /api/v1/reports/{id}/images`, `DELETE /api/v1/reports/{id}/images/{image_id}`; enforce ownership/role, size, content-type, and safe storage checks.
- History: `GET /api/v1/reports/{id}/history` returns only history the actor is allowed to see.

## Matching
- `GET /api/v1/matches/me` for a user's permitted potential matches.
- Staff/admin: `GET /api/v1/staff/matches`, `POST /api/v1/staff/matches/{id}/review`, `POST /api/v1/staff/matches/{id}/dismiss` or equivalent state-transition endpoints.
- Create suggestions on report creation/update or through a documented service/background mechanism. Matching is advisory and must not expose private fields.

## Claims and returns
- `GET /api/v1/claims/me`
- `POST /api/v1/reports/{id}/claims`
- `GET /api/v1/claims/{id}` (claimant and authorized staff/admin only)
- Staff/admin: `GET /api/v1/staff/claims/pending`, `POST /api/v1/staff/claims/{id}/request-information`, `POST /api/v1/staff/claims/{id}/approve`, `POST /api/v1/staff/claims/{id}/reject`.
- Staff/admin: `POST /api/v1/staff/claims/{id}/return` records handover and lifecycle transition in one transaction.
- Optional claimant endpoint to cancel own pending claim, if supported by documented rules.

## Notifications
- `GET /api/v1/notifications/me`
- `POST /api/v1/notifications/{id}/read`
- `POST /api/v1/notifications/read-all`

## Admin and audit
- `GET /api/v1/admin/users`; `PATCH /api/v1/admin/users/{id}` for allowed account/role changes.
- `GET /api/v1/admin/reports`; `GET /api/v1/admin/dashboard`.
- `GET /api/v1/admin/audit-logs` with pagination and filters; admin-only.

## Contract requirements
- Do not expose ownership evidence, internal review notes, private contact data, password hashes, or precise custody location through public DTOs.
- Verify owner, role, and allowed status transition on every mutation; never trust user/role IDs supplied by the client when identity can come from the token/session.
- Use 401, 403, 404, 409, and 422 consistently. Use 404 for inaccessible private resources if needed to avoid confirming their existence.
- Paginate list endpoints, set a maximum page size, and return stable sorting.
- Return safe error details; do not leak stack traces or sensitive data.
- Keep OpenAPI descriptions current. Add API tests for success, invalid input, unauthorized access, forbidden access, and invalid workflow state.
