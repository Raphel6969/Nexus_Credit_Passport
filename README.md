# Nexus Credit Passport

Portable, business-owned credit identity for Indian MSMEs.

## Quick Start

```bash
# Prerequisites
# - Docker & Docker Compose
# - Node 22 (nvm use)
# - Python 3.12 (conda)
# - Go 1.22+
# - Rust 1.97.0 (rustup)

# Start all services
docker compose up -d

# Verify health
curl localhost:8000/healthz   # API
curl localhost:8080/healthz   # Ingestion
curl localhost:8081/healthz   # Scoring
curl localhost:3000/api/health  # Web
```

## Services

| Service | Port | Tech | Purpose |
|---------|------|------|---------|
| api | 8000 | FastAPI | Orchestration, public API, consent |
| ingestion | 8080 | Go | AA/webhook consumers, normalization |
| scoring | 8081 | Rust | TEE-bound scoring + explainability |
| web | 3000 | Next.js | Dashboard UI |

## Development

```bash
# Install pre-commit hooks
pre-commit install

# Run all checks locally
pre-commit run --all-files

# Run tests per service
cd services/api && conda activate nexus-api && pytest
cd services/ingestion && go test ./...
cd services/scoring && cargo test
cd apps/web && npm test
```

## Project Structure

```
nexus-credit-passport/
├── services/
│   ├── api/           # FastAPI service
│   ├── ingestion/     # Go ingestion service
│   └── scoring/       # Rust scoring service
├── apps/
│   └── web/           # Next.js dashboard
├── docs/
│   ├── whitepaper.md
│   ├── architecture-decisions/
│   ├── backlog.md
│   └── api-contracts/
├── infra/
│   ├── scripts/
│   └── docker/
├── docker-compose.yml
└── .github/workflows/
```

## Architecture Decision Records

See `docs/architecture-decisions/` for ADRs.

## License

Proprietary — Nexus Credit Passport team.