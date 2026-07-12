# Backlog

Product & tech debt backlog. One item per line. Move to sprint when committed.

## Phase 0 (Done)
- [x] Repo skeleton + Docker Compose
- [x] Pre-commit hooks (ruff, black, gofmt, rustfmt, prettier, gitleaks)
- [x] CI skeleton (lint + test stubs)

## Phase 1 — Data Model
- [ ] ADR 001: Financial graph schema (accounts, transactions, counterparties, cash-flow events, consent tokens)
- [ ] Alembic migration for core schema
- [ ] SQLAlchemy models in API service
- [ ] Go structs in Ingestion service
- [ ] sqlx models in Scoring service

## Phase 2 — First Vertical Slice (Setu AA Sandbox)
- [ ] Setu AA sandbox connector (Go)
- [ ] Normalization: raw FI → financial graph rows
- [ ] API: consent flow endpoints (`/v1/consent/link`, `/v1/consent/status`)
- [ ] API: sync trigger endpoint (`/v1/accounts/{id}/sync`)
- [ ] Dummy XGBoost model in Rust (returns fixed score + fake SHAP)
- [ ] API: score endpoint (`/v1/accounts/{id}/score`)
- [ ] Web: bare page showing score number
- [ ] API key middleware on all `/v1/*` routes

## Phase 3 — Expand Data Sources
- [ ] GSTN sandbox / synthetic connector
- [ ] Razorpay webhook connector
- [ ] Tally/Zoho accounting connector (pick one)
- [ ] Connector interface standardization (revisit Phase 2 pattern)

## Phase 4 — Real Scoring & Explainability
- [ ] Training pipeline (separate repo/notebook) on public MSME proxy data
- [ ] CatBoost/XGBoost model artifact + versioning
- [ ] SHAP integration in Rust scoring service
- [ ] Human-readable driver formatting (strengths/weaknesses)
- [ ] API returns structured explanation, not raw SHAP values

## Phase 5 — Consent & Distribution Layer
- [ ] Scoped token model: full-profile / score-only / one-time-snapshot
- [ ] Token minting endpoint (`POST /v1/shares`)
- [ ] Token resolution endpoint (`GET /v1/shares/{token}`) — no auth, token in URL
- [ ] Revocation endpoint (`DELETE /v1/shares/{token}`)
- [ ] Audit log for all consent actions
- [ ] Expiry & rotation policies

## Phase 6 — UI Pass (Neumorphic Dashboard)
- [ ] NeuCard, NeuButton, NeuGauge, NeuToggle components
- [ ] Login / consent linking screen
- [ ] Dashboard: centered score gauge (neu gauge)
- [ ] Score driver panel (strengths/weaknesses from SHAP)
- [ ] Share Passport panel with scope toggles
- [ ] Tailwind config with navy/teal/gold palette

## Phase 7 — Hardening & Demo Readiness
- [ ] Full auth (login, sessions, RBAC) on API
- [ ] Rate limiting (token bucket per API key)
- [ ] Error handling + structured logging (tracing)
- [ ] Seed/demo data script (`infra/scripts/seed.py`)
- [ ] README: run locally in <10 min
- [ ] Investor demo checklist

## Tech Debt / Infra (Ongoing)
- [ ] Doppler/1Password secret management (pre-investor demo)
- [ ] Postgres connection pooling (PgBouncer)
- [ ] Structured logging + log aggregation (Loki/Grafana)
- [ ] Metrics / Prometheus endpoints on all services
- [ ] E2E tests (Playwright) for critical flows
- [ ] Contract testing (Pact) between API ↔ Ingestion ↔ Scoring
- [ ] Database backup/restore runbook
- [ ] Incident response runbook

## Ideas (Not Prioritized)
- [ ] Neo4j migration if multi-hop queries become painful
- [ ] Kafka for async ingestion pipeline
- [ ] Kubernetes deployment manifests
- [ ] Multi-tenant isolation (row-level security)
- [ ] LLM-powered narrative summaries of score drivers
- [ ] Mobile app (React Native)