# Phase 0 Plan — Environment & Skeleton

## Goal
`docker-compose up` brings up Postgres + 4 services (api, ingestion, scoring, web), each exposing `/healthz` returning `200 OK`. Pre-commit hooks and CI skeleton run on every commit.

---

## Files to Create / Modify

### 1. Repository Root
| File | Purpose |
|------|---------|
| `.gitignore` | Exclude `.env*`, `*.env`, `*.pyc`, `__pycache__/`, `target/`, `node_modules/`, `.next/`, `dist/`, `*.log`, `.DS_Store`, `*.pem`, `*.key`, `*.crt`, `*.p12`, `.conda/`, `venv/`, `.envrc`, `*.db`, `*.sqlite` |
| `.nvmrc` | `22` (pinned Node LTS) |
| `.pre-commit-config.yaml` | Hooks: `ruff`, `black`, `gofmt`, `rustfmt`, `prettier`, `gitleaks`/`detect-secrets` |
| `docker-compose.yml` | Postgres 16 + 4 services (api, ingestion, scoring, web) each with `/healthz` healthcheck |
| `README.md` | Project overview, quick-start (`docker compose up`), env setup per service |
| `environment.yml` (root, optional) | Not needed — each Python service has its own |

### 2. Documentation Skeleton
| File | Purpose |
|------|---------|
| `docs/whitepaper.md` | Stub — founder to fill in |
| `docs/architecture-decisions/README.md` | Placeholder for ADRs |
| `docs/backlog.md` | Empty backlog template |
| `docs/api-contracts/README.md` | Placeholder for OpenAPI/protobuf specs |

### 3. Service: `services/api` (FastAPI, Python 3.12, conda)
| File | Purpose |
|------|---------|
| `environment.yml` | `python=3.12`, `fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, `sqlalchemy`, `asyncpg`, `alembic`, `python-jose[cryptography]`, `passlib[bcrypt]`, `python-multipart`, `httpx`, `pytest`, `pytest-asyncio`, `httpx` |
| `app/main.py` | FastAPI app + `/healthz` endpoint |
| `app/core/config.py` | Pydantic-settings config (loads from env) |
| `app/core/db.py` | SQLAlchemy async engine + session |
| `app/core/security.py` | Password hashing, JWT helpers (stubs) |
| `app/routers/health.py` | `/healthz` router |
| `tests/test_health.py` | `pytest` health check test |
| `Dockerfile` | Multi-stage: conda env → copy app → run uvicorn |
| `.dockerignore` | Exclude `__pycache__`, `.pytest_cache`, `.coverage`, `tests/`, `.git/` |

### 4. Service: `services/ingestion` (Go 1.23+)
| File | Purpose |
|------|---------|
| `go.mod` | `github.com/nexus-credit-passport/ingestion` |
| `go.sum` | Go module checksums |
| `cmd/main.go` | HTTP server + `/healthz` |
| `internal/health/health.go` | Health handler |
| `Dockerfile` | Multi-stage: `golang:1.23-alpine` build → `alpine` runtime |
| `.dockerignore` | Exclude `vendor/`, `.git/`, `*.test` |

### 5. Service: `services/scoring` (Rust 1.97.0 stable)
| File | Purpose |
|------|---------|
| `Cargo.toml` | `axum`, `tokio`, `serde`, `serde_json`, `tracing`, `anyhow` |
| `rust-toolchain.toml` | `channel = "stable"` + `components = ["rustfmt", "clippy"]` (pinned to 1.97.0) |
| `src/main.rs` | Axum server + `/healthz` |
| `src/health.rs` | Health handler |
| `Dockerfile` | Multi-stage: `rust:1.97-slim` build → `debian:bookworm-slim` runtime |
| `.dockerignore` | Exclude `target/`, `.git/`, `Cargo.lock` (optional) |

### 6. Service: `apps/web` (Next.js 14+, Tailwind, Node 22)
| File | Purpose |
|------|---------|
| `.nvmrc` | `22` |
| `package.json` | `next@14`, `react@18`, `tailwindcss`, `postcss`, `autoprefixer`, `eslint`, `prettier`, `jest`, `@testing-library/react` |
| `next.config.js` | Basic config, output `standalone` for Docker |
| `tailwind.config.ts` | Tailwind config (neumorphic colors placeholder) |
| `postcss.config.js` | PostCSS config |
| `app/layout.tsx` | Root layout |
| `app/page.tsx` | Home page with `/api/health` link |
| `app/api/health/route.ts` | `/api/health` route (Next.js API route) returning `{status: "ok"}` |
| `Dockerfile` | Multi-stage: `node:22-alpine` build → `node:22-alpine` runtime |
| `.dockerignore` | Exclude `.next/`, `node_modules/`, `.git/`, `*.log` |

### 7. Infrastructure
| File | Purpose |
|------|---------|
| `infra/docker/Dockerfile.api` | (Optional — can live in service dir; decision: keep Dockerfile in each service dir) |
| `infra/scripts/` | Empty dir for future migration/seed scripts |
| `.github/workflows/ci.yml` | Lint + test jobs for each service (matrix), runs on push/PR |

### 8. Docker Compose Services
| Service | Port | Healthcheck |
|---------|------|-------------|
| `postgres` | 5432 | `pg_isready` |
| `api` | 8000 | `curl -f http://localhost:8000/healthz` |
| `ingestion` | 8080 | `curl -f http://localhost:8080/healthz` |
| `scoring` | 8081 | `curl -f http://localhost:8081/healthz` |
| `web` | 3000 | `curl -f http://localhost:3000/api/health` |

All services depend on `postgres` (except web, which depends on api). Healthchecks use `interval: 10s`, `timeout: 5s`, `retries: 5`.
Postgres image: `postgres:18` (aligned with local version).

---

## Key Decisions (Non-Negotiable)
1. **One conda env per Python service** — `services/api/environment.yml` only (scoring is Rust)
2. **Node 22** pinned via `.nvmrc` at root + `apps/web/.nvmrc`
3. **Rust 1.97.0** pinned via `rust-toolchain.toml` in `services/scoring/`
4. **Dockerfiles live in each service directory** (not `infra/docker/`) — matches service ownership
5. **Pre-commit runs on every commit** — `ruff`, `black`, `gofmt`, `rustfmt`, `prettier`, `gitleaks`
6. **CI runs same checks** — no divergence between local and CI
7. **Healthcheck endpoint path: `/healthz`** on API, Ingestion, Scoring; **`/api/health`** on Web (Next.js API route)
8. **Phase 2 API gate**: single shared bearer-token/API-key middleware (static secret, rotated later) — **not** real auth, just a lock on the door. Phase 5 consent/scope tokens are a separate concern.
9. **Migration ownership**: Shared financial-graph tables (accounts, transactions, counterparties, cash-flow events) owned by **alembic in API service only**. Ingestion & Scoring read/write but never migrate those tables. Each service manages its own operational tables via its own tool (golang-migrate, sqlx-cli).
10. **Env hygiene**: Every service ships a checked-in `.env.example` with real var names + dummy values. `.env.local` is gitignored. `gitleaks` verified to catch `.env.local` in pre-commit dry-run before first real commit.
11. **Secret management backlog**: Doppler/1Password before any investor-facing demo touches real sandbox credentials — tracked in `docs/backlog.md`.

---

## Open Questions for Founder (Decide Before Phase 1)
1. **API versioning strategy**: `/v1/` prefix from Phase 1, or defer?

---

## Commit Plan (Atomic)
1. `chore(repo): add root config (.gitignore, .nvmrc, .pre-commit-config.yaml, docker-compose.yml, README.md)`
2. `chore(docs): add docs skeleton (whitepaper stub, ADR dir, backlog, api-contracts)`
3. `chore(api): add FastAPI skeleton with health check, conda env, Dockerfile, tests`
4. `chore(ingestion): add Go skeleton with health check, Dockerfile`
5. `chore(scoring): add Rust skeleton with health check, Cargo.toml, rust-toolchain.toml, Dockerfile`
6. `chore(web): add Next.js skeleton with /api/health, Dockerfile, Tailwind config`
7. `chore(ci): add GitHub Actions workflow (lint + test skeleton)`
8. `chore(infra): add infra/scripts and infra/docker dirs`

---

## Deliverable Checklist
- [ ] `docker compose up -d` → all 5 containers healthy
- [ ] `curl localhost:8000/healthz` → `{"status":"ok"}`
- [ ] `curl localhost:8080/healthz` → `{"status":"ok"}`
- [ ] `curl localhost:8081/healthz` → `{"status":"ok"}`
- [ ] `curl localhost:3000/api/health` → `{"status":"ok"}`
- [ ] `pre-commit run --all-files` passes
- [ ] `gitleaks detect --source . --verbose` catches `.env.local` test file
- [ ] `git push` → CI passes (lint + test stubs)

---

**Ready for approval.** Once approved, I’ll implement in the commit order above.