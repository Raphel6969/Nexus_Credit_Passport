# ADR 001: Financial Graph Schema and Trust Boundary

**Date:** 2026-07-13  
**Status:** Accepted

## Context

Nexus Credit Passport requires a central data model to store the normalized financial graph of Indian MSMEs. The system ingests data from various sources (Account Aggregator, GSTN, Razorpay, Tally) and provides it to the Rust-based scoring enclave. The architecture mandates strict trust boundaries: only the Rust scoring service is permitted to decrypt raw PII. The API and Web layers must only see derived, consented views.

## Decisions

### 1. Core Schema Entities

The Postgres schema will model the financial graph through the following core tables:

- **`businesses`**: The root MSME entity owning the Passport.
- **`accounts`**: Data sources linked to the business (e.g., a specific bank account or GST profile).
- **`counterparties`**: Extracted entities the business transacts with (suppliers, customers, lenders).
- **`transactions`**: Raw, normalized ledger entries from the accounts.
- **`cash_flow_events`**: Semantic, categorized events derived from transactions, used directly by the ML model.
- **`consent_tokens`**: Tokens managing the scope and duration of third-party access to the Passport.

### 2. Cryptographic Trust Boundary (PII Encryption)

To cryptographically enforce the trust zone boundary, we will use **asymmetric sealed-box encryption** (e.g., libsodium `crypto_box_seal` or `age`) for PII fields (`transaction.description` and `counterparty.name/identifier`).
- **Ingestion (Go)** holds the **public key** and can only encrypt data before writing to Postgres.
- **Scoring (Rust)** holds the **private key** and is the only service that can decrypt the data.
- **API (Python)** has no access to either key and cannot read the raw PII.
- This ensures that a compromise of the Go ingestion service, Python API, or the database itself does not leak decrypted PII. Key rotation and KMS integration are deferred to Phase 7.

### 3. Financial Amounts and Currency

All financial amounts must avoid floating-point drift:
- **`amount`**: Stored as a `BIGINT` representing minor units (e.g., paise for INR).
- **`currency`**: Added to all amount-bearing tables as `CHAR(3)` (ISO 4217), defaulting to `'INR'`. This anticipates cross-border trade scenarios without requiring a painful schema backfill later.

### 4. Account Source and FI Types

To support both Account Aggregator (AA) data and non-AA alternative data (GST, Payment Gateways), the `accounts` table will decouple the data source from the specific financial instrument type:
- **`source_type`**: Represents the origin of the data (`AA`, `RAZORPAY`, `GSTN`, `ECOMMERCE`).
- **`fi_type`**: Maps directly to the canonical Rebit FI Types (e.g., `DEPOSIT`, `TERM_DEPOSIT`, `RECURRING_DEPOSIT`). Non-AA sources may leave this null or use appropriate alternative classifications. We will not invent a generalized type abstraction yet.

### 5. API Versioning

All external API routes will be prefixed with `/v1/` from Phase 1. This is a "cheap now, expensive later" decision that prevents breaking client integrations once real usage begins.

## Consequences

- The Ingestion service must bundle an asymmetric encryption library to seal PII fields before writing.
- The Python API service cannot be used to serve raw transaction descriptions to the dashboard; any human-readable transaction history must be either served by the Rust service or handled via derived metrics.
- Financial calculations across the stack must be mindful of integer-based minor units and dynamically handle currency formatting.
