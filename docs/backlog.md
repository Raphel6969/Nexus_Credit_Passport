# Backlog

Product & tech debt backlog. One item per line. Move to sprint when committed.

## Phase 0 (Done)
- [x] Repo skeleton + Docker Compose
- [x] Pre-commit hooks (ruff, black, gofmt, rustfmt, prettier, gitleaks)
- [x] CI skeleton (lint + test stubs)

## Phase 1 — Data Model ✅
- [x] ADR 001: Financial graph schema (accounts, transactions, counterparties, cash-flow events, consent tokens)
- [x] Alembic migration for core schema (001_initial_schema)
- [x] Alembic migration — Indian market fields (002_add_indian_market_fields)
- [x] SQLAlchemy models in API service
- [x] Go structs in Ingestion service
- [x] Rust model structs in Scoring service (sqlx deferred to Phase 4)

## Phase 2 — First Vertical Slice (Setu AA Sandbox) ✅
- [x] Mock Setu AA server (Go) — real response shape, swap via SETU_BASE_URL
- [x] Setu AA client (Go) — CreateConsent, CreateSession, GetFIData
- [x] Normalizer (Go) — Rebit floats→paise, IST timestamps, UPI VPA extraction
- [x] PII sealing (Go) — `filippo.io/age` sealed-box + HMAC blind index
- [x] pgx store (Go) — UpsertTransaction with dedup on `external_id_hmac`
- [x] Ingestion trigger — POST /v1/ingest/aa
- [x] Rust scoring stub — pure ScoringInput→ScoringOutput, no DB/network
- [x] FastAPI score proxy — GET /v1/businesses/{id}/score
- [x] FastAPI ingest proxy — POST /v1/businesses/{id}/ingest/aa
- [x] Next.js score dashboard — SVG gauge, last-synced timestamp
- [x] Universal root .env consolidation (single .env.example + .env.local)

## Phase 3 — Expand Data Sources
- [ ] GSTN sandbox / synthetic connector
- [ ] Razorpay webhook connector
- [ ] Tally/Zoho accounting connector (pick one)
- [ ] Connector interface standardization (revisit Phase 2 pattern)

## Phase 4 — Real Scoring & Explainability ✅
- [x] Synthetic MSME training pipeline (`infra/scripts/train_model.py`) — 3K records, 4 tiers
- [x] Ridge regression model + z-score normalization → `services/scoring/model/model_meta.json`
- [x] Rust data-access pattern RESOLVED: direct `sqlx` to Postgres from scoring service
- [x] 12-feature extractor (`src/features/extractor.rs`) — direct Postgres queries, no PII columns
- [x] SHAP integration (exact linear SHAP: contribution_i = coeff_i × z_score_i)
- [x] Human-readable driver formatting — top-5 strengths + top-3 weaknesses with plain-English notes
- [x] Scoring engine (`src/score/engine.rs`) — loads JSON model, linear inference
- [x] API returns structured explanation: score + confidence + drivers[]
- [x] score_snapshots table (migration 004) — append-only audit log with JSONB drivers
- [x] GET /v1/businesses/{id}/score/history — scoring trend endpoint for Phase 6 dashboard

### Phase 4 Tech Debt / Future Upgrade
- [ ] Upgrade model to XGBoost on real MSME dataset (architecture already supports it — swap model_meta.json)
- [ ] TreeSHAP (exact) when tree model is in use; current linear SHAP is already exact for Ridge
- [ ] Revenue consistency: replace proxy with real monthly std-dev CTE query
- [ ] Score caching: serve cached snapshot on GET without calling Rust every time (Phase 7 hardening)

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