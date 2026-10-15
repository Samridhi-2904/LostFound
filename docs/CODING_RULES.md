# Coding Rules

## Workflow
- Inspect the repository and read all project docs before editing. Preserve working code and existing conventions where they do not conflict with requirements.
- Implement only the current phase; do not build the frontend during backend foundation phases.
- Ask before destructive changes, database wipes, history rewrites, or deleting existing functionality.
- Keep documentation in sync with actual behaviour and known gaps.

## Code quality
- Use type hints, descriptive names, small functions, and clear beginner-friendly comments where they explain why.
- Separate routers, schemas/DTOs, models, services, configuration, and tests.
- Keep business rules and state transitions in services, not scattered across routes/UI.
- Use enums/constants for actor roles and statuses; do not duplicate status strings inconsistently.
- Use SQLAlchemy 2.x patterns, foreign keys, constraints, indexes, UTC-aware timestamps, and Alembic migrations.
- Avoid unnecessary dependencies and unrequested AI services.

## Security and privacy
- Use a maintained password-hashing library; never store/log plain passwords.
- Never commit `.env`, secrets, tokens, local database files, or private uploaded files. Provide `.env.example` only.
- Do not log tokens, password values, ownership evidence, or unnecessary personal data.
- Apply authentication, role authorization, and resource ownership checks on the backend for every protected read/write.
- Never trust client-provided role/owner/reviewer IDs when the authenticated identity should determine them.
- Use separate public, owner, staff, and admin response schemas. Do not return raw ORM objects with sensitive columns.
- Validate image contents and size; generate safe storage names; guard against path traversal and unauthorized retrieval.
- Keep precise custody/contact data and claim evidence private.

## Data integrity and workflows
- Use migrations for schema changes; never silently recreate/drop an existing database.
- Centralize status transitions and validate current state before updates.
- Keep ReportStatusHistory and AuditLog consistent with important changes.
- Use transaction boundaries for claim decisions and return/handover state changes.
- A potential match is advisory, never proof of ownership or automatic claim approval.
- A report/item can become Returned only after approved claim and persisted handover confirmation.
- Prevent duplicate active claims and duplicate match pairs.

## Testing and reporting
- Add tests for new business rules, privacy boundaries, role/ownership permissions, and invalid state transitions.
- Run relevant tests/builds after changes; report exact commands and observed results.
- Do not claim a phase, feature, requirement, performance target, or test is complete without evidence.
- Keep the implementation approachable for a student and explain key architectural decisions in plain language.
