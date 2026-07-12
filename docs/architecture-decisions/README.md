# Architecture Decision Records (ADRs)

One file per significant decision. Format: `NNN-short-title.md` (e.g., `001-financial-graph-schema.md`).

## Template

```markdown
# ADR NNN: Title

## Status
Proposed | Accepted | Superseded

## Context
What problem are we solving? What constraints exist?

## Decision
What did we decide? Be specific.

## Consequences
### Positive
- ...

### Negative
- ...

### Risks & Mitigations
- Risk: ... → Mitigation: ...
```

## Index

| ADR | Title | Status |
|-----|-------|--------|
| 001 | Financial Graph Schema (Phase 1) | Proposed |
| 002 | API Versioning Strategy | Accepted |
| 003 | Migration Ownership Split | Accepted |
| 004 | Phase 2 API Key Gate | Accepted |
| 005 | Scoring Service Trust Boundary | Proposed |

## Accepted Decisions (Pre-Phase 1)

### ADR 002: API Versioning Strategy
- **Decision**: `/v1/` prefix from Phase 1 onward. No versionless endpoints.
- **Rationale**: Explicit, easy to route, clear deprecation path.

### ADR 003: Migration Ownership Split
- **Decision**: Shared financial-graph tables (accounts, transactions, counterparties, cash-flow events) owned by **alembic in API service only**. Ingestion & Scoring manage their own operational tables via golang-migrate / sqlx-cli.
- **Rationale**: Single source of truth for core schema; avoids race conditions on `ALTER TABLE`.

### ADR 004: Phase 2 API Key Gate
- **Decision**: Single static bearer token middleware on all `/v1/*` routes from Phase 2. Not real auth — just a lock on the door.
- **Rationale**: Retrofitting even basic auth later is painful; keeps "who can call the API" separate from "who can see which Passport" (Phase 5 consent tokens).