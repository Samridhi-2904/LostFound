# Architecture

## High-level structure
1. **React + Vite + TypeScript frontend** (introduced only after backend phases): responsive pages, forms, search, and role-specific views.
2. **FastAPI backend:** validation, authentication, authorization, API contracts, workflow enforcement, notifications, matching, and audit events.
3. **Relational database:** SQLAlchemy models and Alembic migrations; SQLite locally, PostgreSQL-compatible configuration.
4. **Local upload storage for development:** validated image files outside public source directories, with metadata stored in the database. Do not expose private storage directly.

Request flow: Browser → typed API client → FastAPI router → authentication/permission dependencies → service/business rule → SQLAlchemy session → database. Matching and notification creation should be invoked from a service/transaction or a simple background task only if task failure and retry behaviour are documented.

## Backend module boundaries
- `app/main.py`: application setup, routers, lifespan, safe CORS configuration.
- `app/api/`: versioned HTTP routers only; avoid embedding complex business logic in routes.
- `app/core/`: settings, password hashing, token/session handling, role dependencies, logging.
- `app/db/`: engine, session factory, base metadata.
- `app/models/`: SQLAlchemy entities and relationships.
- `app/schemas/`: request/response DTOs separated by actor/privacy level.
- `app/services/`: report workflows, matching, claim decisions, returns, notifications, audit logging.
- `app/tests/`: isolated test configuration, fixtures, API/service tests.
- `alembic/`: migrations.

## Cross-cutting rules
- Use `/api/v1` for application endpoints; health may be `/health`.
- Configure secrets, database URL, token/session expiry, upload directory/limit, and allowed frontend origin via environment variables. Include `.env.example`, never real secrets.
- Use explicit public/user/staff/admin schemas. A route must not return a raw ORM model containing private columns.
- Use consistent HTTP responses: 401 unauthenticated, 403 forbidden, 404 missing or deliberately concealed private resource, 409 conflicting state, 422 invalid request.
- Apply backend role and ownership checks to every protected endpoint; test direct API calls that bypass the frontend.
- Prefer transaction boundaries for claim decisions, return creation/status transition, and history/audit persistence so partial writes do not leave contradictory state.
- Use a deterministic, explainable matching baseline first (category, normalized keywords/attributes, date proximity, and location text). Store score/reasons and allow review/dismissal. No claim is automatically approved.
- Notifications must be persisted and contain only privacy-safe text. Failure handling should not roll back an otherwise valid report unless the design explicitly requires it.
- Log useful operational events without credentials, tokens, private evidence, or unnecessary personal data.

## Session/security note
The SRS requires expiration after 30 minutes of inactivity and sign-out invalidation. Pure stateless JWT access tokens do not by themselves support immediate server-side revocation or true inactivity tracking. Implement an appropriate session/refresh-token or token-version/revocation strategy, or document the limitations and ensure the practical behaviour is tested. Do not claim full compliance solely because an access token has an expiry timestamp.

## Local development vs deployment
Run backend and frontend separately during development. Use HTTPS, secure cookie/token settings, managed secrets, controlled file storage, and deployment configuration before describing the app as production-ready. Do not claim deployment or performance targets are verified without measurements.
