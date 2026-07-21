# Nexus Credit Passport — Project Context & Architectural Decisions

This document serves as the primary onboarding guide for any new developer or AI agent joining the Nexus Credit Passport project. It outlines the project's evolution, the key architectural decisions made in each phase, and the upcoming backlog.

---

## 🏗️ Architecture Overview

Nexus Credit Passport is a multi-service platform designed to ingest financial data from diverse Indian market sources (Account Aggregator, GSTN, Payment Gateways, Accounting Software), normalize it, safely handle PII, and generate an MSME credit score.

1. **FastAPI (Python)**: The public-facing API layer. Handles client requests, authentication, and acts as a proxy to internal services.
2. **Ingestion Service (Go)**: High-throughput data ingestion pipeline. Connects to external data sources (e.g., Setu AA, GSTN), normalizes payloads, asymmetrically encrypts PII, and handles Postgres upserts.
3. **Scoring Service (Rust)**: The credit scoring engine. Reads aggregated (non-PII) data **directly from Postgres** to run the ML model and return scores with SHAP-style driver breakdown.
4. **PostgreSQL**: The central database. Stores relational data, encrypted PII payloads, and blind-indexed hashes.

---

## 📜 Completed Phases

### Phase 0: Environment & Skeleton
**Goal:** Establish repo skeleton, CI, and local dev stack.
- Full repo structure, conda envs, Docker Compose with Postgres.
- Pre-commit hooks: ruff, black, gofmt, rustfmt, prettier, gitleaks.
- CI skeleton on GitHub Actions.
- **Deliverable:** `docker-compose up` brings up empty Postgres + 4 services with `/healthz`.

### Phase 1: Data Model
**Goal:** Establish the core infrastructure and API schema.
- **Tech Stack Chosen:** FastAPI (Python), PostgreSQL, Docker Compose.
- **Database Driver:** Used `asyncpg` with SQLAlchemy for high-performance async DB access in Python.
- **API Endpoints:** Created baseline routing for `/businesses`, `/ingest`, and `/score`.
- **Schema:** ADR 001 written. Migrations 001 (initial schema) and 002 (Indian market fields).
- **Outcome:** A functional Dockerized API capable of managing business records.

### Phase 2: Setu AA Integration & PII Strategy
**Goal:** Integrate the first major data source (Setu Account Aggregator) and define the PII protection strategy.
- **Microservices Introduced:** Split ingestion to **Go** (for fast JSON/XML stream parsing) and scoring to **Rust** (for performance and ML interoperability).
- **PII Encryption (age):** Implemented asymmetric encryption using `age`. The Go Ingestion Service holds the **Public Key** to encrypt sensitive data (e.g., transaction narrations). Only the Rust Scoring Service holds the **Private Key** to decrypt data if needed. The API layer never sees plaintext PII.
- **Deduplication (HMAC Blind Indexing):** To safely deduplicate transactions without storing raw IDs, we implemented a keyed HMAC blind index (SHA-256).
- **Outcome:** Go service can pull mock Setu AA data, encrypt PII, and insert it into Postgres. A basic heuristic Rust scoring stub was created.

### Phase 3: Multi-Source Architecture & Indian Market Data
**Goal:** Generalize the ingestion pipeline to support multiple sources (GSTN, Razorpay, Zoho Books) without duplicating logic or causing data leaks.
- **Connector Standardization:** Refactored to a strict `SourceConnector` interface.
- **Single PII Chokepoint:** Built a centralized `Orchestrator` in Go. Connectors return plaintext generic formats (`RawTransaction`, `RawCounterparty`); the Orchestrator passes them through a single `pii.Processor` before hitting the database. This prevents individual connectors from leaking PII or rolling their own encryption.
- **Revenue Double-Counting Prevention:** Added `revenue_role` to the `transactions` table. Bank accounts (AA) act as the `primary` source of truth for cash flow, while Razorpay/GSTN act as `informational` or `tax_summary` to prevent duplicate aggregate calculations.
- **Database Schema Expansion (Migration 003):** Added `tax_filings`, `invoices`, and `cash_flow_events` tables. Updated `counterparties` to support cross-source matching (`source_type`, `identifier_hmac`).
- **Outcome:** The pipeline successfully ingests data concurrently from Setu AA, GSTN, Razorpay, and Zoho Books mock servers, encrypts PII universally, and evaluates a multi-source credit score.

### Phase 4: Real Scoring & Explainability ✅
**Goal:** Replace the heuristic stub with a real ML-trained model and SHAP-style driver attribution.

#### Key Decisions Made

**Rust data-access pattern (Phase 2 deferred decision — resolved):**
The Rust scoring service now queries Postgres **directly via sqlx**. This resolves the deferred decision from Phase 2: routing feature aggregation through the Python API would have violated the trust boundary (Python aggregating what it should never see). The API layer sends only `{ business_id }` and receives the derived score output.

**Model architecture:**
- **Training:** `infra/scripts/train_model.py` generates 3,000 synthetic Indian MSME records across 4 credit tiers (stressed/average/good/excellent) and trains a **Ridge regression** model on 12 named features.
- **Serialization:** Model coefficients + normalization parameters (z-score means/stds) exported to `services/scoring/model/model_meta.json` — a plain, diffable JSON file.
- **Inference:** Rust loads `model_meta.json` at startup; no external ML runtime required. Score = clamp(intercept + Σ coeff_i × z_score_i, 300, 850).
- **SHAP:** For linear models, SHAP is exact: `contribution_i = coeff_i × z_score_i`. No approximation needed.

**Why Ridge regression + JSON (not XGBoost + ONNX):**
- Zero ML-runtime dependency in Rust (no libonnxruntime.so, no C++ bindings)
- Linear SHAP is mathematically exact
- Model artifact is plain JSON — readable, diffable, version-controlled
- Architecture is identical to what a tree ensemble would use; swapping to XGBoost is a deployment-time change when real MSME data is available

#### Features Extracted (12 named features, all non-PII):
| # | Feature | Source |
|---|---------|--------|
| 0 | `total_transactions` | transactions table |
| 1 | `upi_ratio` | transactions.mode = 'UPI' |
| 2 | `credit_debit_ratio` | SUM credits / SUM debits (capped 3.0) |
| 3 | `nach_debit_count` | transactions.mode = 'NACH' AND type = 'DEBIT' |
| 4 | `avg_monthly_revenue_lakh` | SUM primary credits / data_window_months |
| 5 | `gst_compliance_ratio` | filed_count / total_filings |
| 6 | `gst_turnover_lakh` | SUM tax_filings.gross_turnover |
| 7 | `current_balance_lakh` | accounts.balance (latest) |
| 8 | `invoice_overdue_ratio` | overdue_receivables / total_receivables |
| 9 | `data_window_months` | MAX(txn.timestamp) - MIN(txn.timestamp) |
| 10 | `transaction_velocity` | total_transactions / data_window_months |
| 11 | `revenue_consistency` | proxy from cf_ratio and NACH count |

#### New Files (Phase 4):
- `infra/scripts/train_model.py` — synthetic data generator + Ridge training + JSON export
- `services/scoring/model/model_meta.json` — serialized model (committed; rebuilt by running the training script)
- `services/scoring/src/features/extractor.rs` — direct Postgres feature extraction (sqlx)
- `services/scoring/src/score/engine.rs` — model loader, linear inference, SHAP computation
- `services/scoring/src/explain/mod.rs` — ScoreDriver struct, format_drivers(), human notes for all 12 features
- `services/api/alembic/versions/004_score_cache.py` — score_snapshots migration
- `services/api/app/models/graph.py` — ScoreSnapshot ORM model added

#### API Response (Phase 4):
```json
{
  "business_id": "...",
  "score": 712,
  "confidence": "HIGH",
  "note": "Score computed by Nexus Credit Passport linear-v1.0.0...",
  "model_version": "linear-v1.0.0",
  "drivers": [
    {
      "feature": "gst_compliance_ratio",
      "label": "GST Filing Compliance",
      "direction": "positive",
      "impact": 28.5,
      "raw_value": 0.95,
      "human_note": "95% GST filings submitted on time — strong tax compliance record; lenders view this favourably."
    },
    ...
  ]
}
```

Also added: `GET /v1/businesses/{id}/score/history` — returns scoring history for Phase 6 trend chart.

### Phase 5: Consent & Distribution Layer ✅
**Goal:** Implement the distribution layer to allow businesses to share their passport with lenders securely and dynamically.
- **Opaque URL-Safe Tokens:** Used `secrets.token_urlsafe(32)` to generate opaque random share links instead of JWTs, preventing metadata leakage.
- **Three Scopes Supported:**
  - `SCORE_ONLY`: Returns business name and score metrics only (no drivers, no metadata).
  - `FULL_PROFILE`: Returns the full dynamic score profile, including all SHAP drivers and metadata.
  - `SNAPSHOT`: A one-time-use snapshot. Bakes the score and driver data into the token at mint-time. The token immediately expires and marks itself as used after the first successful resolution.
- **Append-Only Audit Log:** Created `consent_audit_log` table (migration 005) to track all `MINTED`, `RESOLVED`, `REVOKED`, and `EXPIRED` events with requester IPs and timestamps.
- **Public Resolver Endpoint:** `GET /v1/shares/{token}` is intentionally public and unauthenticated. The token acts as the credential. Protected endpoints (`POST /v1/shares`, `DELETE /v1/shares/{token}`, and `GET /v1/businesses/{id}/shares`) require `X-API-Key`.

---

### Phase 6: UI Pass (Neumorphic Dashboard) ✅
- Implemented Neumorphic design system (NeuCard, NeuButton, NeuGauge, NeuSegmentedControl) with custom Tailwind dark theme.
- Interactive Dashboard: centered score gauge, SHAP score driver list, link-sharing with custom expiry dates & scope toggles.
- Live Account Aggregator (AA) and Razorpay ingestion console.

---

## 🌟 Nexus V2 Product Features

### V2 Phase 1: "What-If" EMI Stress Test Simulator ✅
*Proving whether a business can afford a specific loan based on historical cash flow.*
- **Backend (Python)**: `GET /v1/businesses/{id}/stress-test` endpoint. Calculates monthly EMI, extracts 12-month historical Free Cash Flow (FCF), and calls Groq AI (`llama-3.1-8b-instant`) for credit risk analysis.
- **Frontend (Next.js)**: `LoanSimulator.tsx` Neumorphic component with interactive Loan Amount, Interest Rate, and Tenure sliders, color-coded FCF vs. EMI bar chart, and AI verdict card.
- **Bugs Fixed**: Clamped EMI bar chart scaling factor to `maxVal = Math.max(emi, max_fcf)` to prevent bar height overflow out of chart container.

### V2 Phase 2: Fraud Detection & AML (Banker Persona) ✅
*Identifying synthetic identities and suspicious cash flow behaviors.*
- **Backend (Rust)**: Expanded `FeatureExtractor` in `services/scoring/src/features/extractor.rs` to run deep SQL anomaly checks:
  1. `MIDNIGHT_UPI_SPIKE`: Flagged if >10 UPI credit transactions occur between 12 AM and 5 AM IST.
  2. `HIGH_REVENUE_CONCENTRATION`: Flagged if >50% (WARNING) or >80% (CRITICAL) of total revenue originates from a single customer/counterparty.
  - Returns `anomaly_flags: Vec<AnomalyFlag>` out of the Rust raw-zone.
- **Backend (Python & DB)**: Added `anomaly_flags` JSONB column to `score_snapshots` model and created `DashboardInsight` ORM model with Alembic migrations `c07e52ec8bef`, `d30a8bcb1cb3`, and `78cb98f43ce0`.
- **Frontend (Next.js)**: Added a "Risk Alerts (AML & Fraud)" panel in `score-board/page.tsx` displaying active flags with severity badges.

---

## 🔮 Upcoming V2 Roadmap
1. **V2 Phase 3: OCEN Broadcast Mock (The Ecosystem Play)** *(NEXT)*
   - Mock OCEN Gateway endpoint (`POST /api/ocen/broadcast`) simulating credit passport transmission to India Stack lenders (SBI, HDFC, ICICI).
   - Next.js "Broadcast to OCEN" modal & live competing loan offer marketplace table.
2. **V2 Phase 4: Tally ERP Integration (Deep Ingestion)**
   - Go ingestion connector for parsing Tally Daybook XML exports into `RawTransaction` records.
3. **V2 Phase 5: Database-per-Service & Auth Refactor**
   - Isolate Postgres databases per microservice (Ingestion DB, Scoring DB, API DB) and enforce JWT RBAC.

## 🔑 Crucial Rules for Agents & Developers
1. **Never Bypass the PII Chokepoint:** Any new data connector must return plaintext structs to the `orchestrator.go`. **Do not** manually call `age.Encrypt()` inside a connector.
2. **Strict Secrets Separation:** The `AGE_PRIVATE_KEY` must never be loaded into the Python API or Go Ingestion environments. It belongs strictly to the Rust Scoring Service.
3. **Feature extraction stays in Rust:** The Rust scoring service is the only service permitted to read raw transaction aggregates for ML purposes. The Python API layer must not replicate this logic.
4. **Plan Before Modifying:** If adding a new data source or altering the schema, write an `implementation_plan.md` and get approval. Never silently make architectural shifts.

