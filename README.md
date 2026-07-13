# Nexus Credit Passport

Portable, business-owned credit identity for Indian MSMEs.

## Quick Start & Setup Instructions

Follow these steps to quickly set up the project locally.

### 1. Prerequisites
- **Docker & Docker Compose**
- **Node 22** (nvm use)
- **Python 3.12** (conda)
- **Go 1.25+**
- **Rust 1.97.0** (rustup)

### 2. Environment Variables
Create a `.env.local` file in the root directory (you can copy `.env.example` if it exists). You must ensure the following cryptographic keys are generated and set:

```bash
# Generate a new age keypair for PII encryption
go install filippo.io/age/cmd/...@latest
age-keygen
```
Set `AGE_PUBLIC_KEY` and `AGE_PRIVATE_KEY` in `.env.local`. Also generate a 32-byte hex key for `HMAC_BLIND_INDEX_KEY` (e.g. 64 random hex characters).

### 3. Start Services
```bash
# Start all services and mock servers in detached mode
docker compose up -d
```

### 4. Database Migrations
The database schema is managed via Alembic in the FastAPI service. Once the containers are up, apply the migrations:
```bash
docker exec nexus-api alembic upgrade head
```

### 5. Verify Pipeline
You can verify the entire multi-source ingestion pipeline and scoring engine by running the test script:
```bash
# Make sure the X-API-Key in the script matches your .env.local DEV API key
bash ./test_ingest.sh
```

### 6. Verify Health Endpoints
```bash
curl localhost:8000/healthz     # API
curl localhost:8080/healthz     # Ingestion
curl localhost:8081/healthz     # Scoring
curl localhost:3000/api/health  # Web Dashboard
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