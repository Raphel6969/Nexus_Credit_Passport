# Nexus Credit Passport — Project Context & Architectural Decisions

This document serves as the primary onboarding guide for any new developer or AI agent joining the Nexus Credit Passport project. It outlines the project's evolution, the key architectural decisions made in each phase, and the upcoming backlog.

---

## 🏗️ Architecture Overview

Nexus Credit Passport is a multi-service platform designed to ingest financial data from diverse Indian market sources (Account Aggregator, GSTN, Payment Gateways, Accounting Software), normalize it, safely handle PII, and generate an MSME credit score.

1. **FastAPI (Python)**: The public-facing API layer. Handles client requests, authentication, and acts as a proxy to internal services.
2. **Ingestion Service (Go)**: High-throughput data ingestion pipeline. Connects to external data sources (e.g., Setu AA, GSTN), normalizes payloads, asymmetrically encrypts PII, and handles Postgres upserts.
3. **Scoring Service (Rust)**: The credit scoring engine. Reads aggregated (non-PII) or decrypted (via private key) data to run ML models and return scores with confidence bands.
4. **PostgreSQL**: The central database. Stores relational data, encrypted PII payloads, and blind-indexed hashes.

---

## 📜 Completed Phases

### Phase 1: Project Initialization & API Baseline
**Goal:** Establish the core infrastructure and API schema.
- **Tech Stack Chosen:** FastAPI (Python), PostgreSQL, Docker Compose.
- **Database Driver:** Used `asyncpg` with SQLAlchemy for high-performance async DB access in Python.
- **API Endpoints:** Created baseline routing for `/businesses`, `/ingest`, and `/score`.
- **Outcome:** A functional Dockerized API capable of managing business records.

### Phase 2: Setu AA Integration & PII Strategy
**Goal:** Integrate the first major data source (Setu Account Aggregator) and define the PII protection strategy.
- **Microservices Introduced:** Decided to split ingestion to **Go** (for fast JSON/XML stream parsing) and scoring to **Rust** (for performance and ML interoperability).
- **PII Encryption (age):** Implemented asymmetric encryption using `age`. The Go Ingestion Service holds the **Public Key** to encrypt sensitive data (e.g., transaction narrations). Only the Rust Scoring Service holds the **Private Key** to decrypt data if needed. The API layer never sees plaintext PII.
- **Deduplication (HMAC Blind Indexing):** To safely deduplicate transactions without storing raw IDs, we implemented a keyed HMAC blind index (SHA-256).
- **Outcome:** Go service can pull mock Setu AA data, encrypt PII, and insert it into Postgres. A basic heuristic Rust scoring stub was created.

### Phase 3: Multi-Source Architecture & Indian Market Data
**Goal:** Generalize the ingestion pipeline to support multiple sources (GSTN, Razorpay, Zoho Books) without duplicating logic or causing data leaks.
- **Connector Standardization:** Refactored to a strict `SourceConnector` interface.
- **Single PII Chokepoint:** Built a centralized `Orchestrator` in Go. Connectors return plaintext generic formats (`RawTransaction`, `RawCounterparty`); the Orchestrator passes them through a single `pii.Processor` before hitting the database. This prevents individual connectors from leaking PII or rolling their own encryption.
- **Revenue Double-Counting Prevention:** Added `revenue_role` to the `transactions` table. Bank accounts (AA) act as the `primary` source of truth for cash flow, while Razorpay/GSTN act as `informational` or `tax_summary` to prevent duplicate aggregate calculations.
- **Database Schema Expansion:** Added `tax_filings`, `invoices`, and `cash_flow_events` tables. Updated `counterparties` to support cross-source matching (`source_type`, `identifier_hmac`).
- **Outcome:** The pipeline successfully ingests data concurrently from Setu AA, GSTN, Razorpay, and Zoho Books mock servers, encrypts PII universally, and evaluates a multi-source credit score.

---

## 🚀 Phase 4: Backlog & Next Steps (To Be Executed)

Phase 4 focuses on closing out edge-case integrations, moving from polling to real-time streams, and upgrading the scoring engine to a true Machine Learning model.

### 1. Tally ERP Offline Integration
- **Context:** Many Indian MSMEs use offline Tally ERP. 
- **Task:** Build a FastAPI endpoint to accept Tally XML dump uploads. The file must be securely passed to the Go Ingestion service.
- **Go Connector:** Implement a `tally/connector.go` that parses the heavy XML schema, normalizes Vouchers and Ledgers, and feeds them into the central Orchestrator.

### 2. Real-time Webhooks (Razorpay)
- **Context:** Currently, data is fetched via polling (`Sync()`). We want real-time updates for payment gateways.
- **Task:** Add webhook receivers in FastAPI (with signature validation). Forward validated payloads to a new `webhook.go` processor in the Ingestion service to update Postgres instantly.

### 3. Data Reconciliation Engine
- **Context:** We now have counterparties and transactions from multiple sources (e.g., a Razorpay payout vs. an AA bank deposit).
- **Task:** Build an automated reconciliation engine to merge duplicate counterparties using fuzzy matching or exact HMAC identifier matching, ensuring a unified ledger.

### 4. ML Model Implementation (Rust)
- **Context:** The current Rust scoring engine is a heuristic stub (`src/score/stub.rs`).
- **Task:** Replace the stub with a real Machine Learning pipeline. 
- **Tech Options:** Integrate ONNX Runtime (`ort` crate) or `linfa` to load a pre-trained CatBoost/XGBoost model.
- **Explainability:** Implement SHAP (SHapley Additive exPlanations) values to populate the `note` field, providing MSMEs with human-readable reasons for their credit score.

---

## 🔑 Crucial Rules for Agents & Developers
1. **Never Bypass the PII Chokepoint:** Any new data connector must return plaintext structs to the `orchestrator.go`. **Do not** manually call `age.Encrypt()` inside a connector.
2. **Strict Secrets Separation:** The `AGE_PRIVATE_KEY` must never be loaded into the Python API or Go Ingestion environments. It belongs strictly to the Rust Scoring Service.
3. **Plan Before Modifying:** If adding a new data source or altering the schema, write an `implementation_plan.md` and get approval. Never silently make architectural shifts.
