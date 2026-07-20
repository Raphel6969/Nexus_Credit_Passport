# Nexus Credit Passport V2: Product Strategy & Architecture

This document details the transition of Nexus Credit Passport from a hackathon MVP to an enterprise-ready lending product. It covers the strategic feature roadmap, real-world use cases, and the underlying architectural shifts required for production (including Database Management and Authentication).

---

## 1. Architectural Upgrades for Production (V2)

Before implementing massive new features, the core infrastructure must evolve to handle enterprise-grade security, scale, and compliance.

### A. Authentication & Authorization (Auth)
Currently, the system likely trusts raw `businessId` identifiers passed via query parameters or basic headers. This is a massive security risk in production.
*   **Identity Provider (IdP)**: Integrate a robust IdP like Auth0, Keycloak, or AWS Cognito. 
*   **JWT & RBAC**: The frontend must authenticate users and pass a signed JSON Web Token (JWT) in the `Authorization: Bearer <token>` header. The Python API must validate the signature and enforce Role-Based Access Control (RBAC). 
    *   `MSME_OWNER`: Can only view/share their own business data.
    *   `LENDER_AGENT`: Can only view passports that have been explicitly shared with their institution.
*   **Service-to-Service Auth**: The Python API, Go Ingestion, and Rust Scoring services must authenticate with each other using internal JWTs or Mutual TLS (mTLS) so an attacker inside the VPC cannot trigger unauthorized score generations.

### B. Database Handling (Microservices Anti-Pattern)
Currently, the Python, Go, and Rust services all connect to a single, shared Postgres database. This is a well-known anti-pattern (Shared Database) that creates tight coupling. If the Go team changes a table schema, the Rust and Python services might crash.
*   **Database-per-Service**: In V2, each service should own its schema. 
    *   *Go Ingestion DB*: Stores raw API sync states and sealed payloads.
    *   *Rust Scoring DB*: Stores the ML models, SHAP values, and the `age` decryption private key.
    *   *Python API DB*: Stores user profiles, share tokens, dashboard cache, and AI insights.
*   **Event-Driven Architecture**: Instead of sharing tables, use an Event Bus (like Apache Kafka or RabbitMQ). When Go ingests new data, it publishes a `TransactionsIngested` event. Rust listens to this, decrypts the data, generates a score, and publishes a `ScoreGenerated` event. Python listens to this to update the UI.

---

## 2. High-Value Product Features

### Feature 1: "What-If" EMI Stress Test
**The Problem**: A high credit score doesn't guarantee a business has enough cash flow to afford a specific EMI payment in a bad month.
**The Feature**: A Loan Simulator slider on the dashboard. The MSME inputs a desired loan amount and rate. The Python backend calculates the EMI and overlays it against their historical monthly "Free Cash Flow" (Earned minus Spent). Groq AI analyzes this data to say: *"In 3 of the last 12 months, your free cash flow fell below this EMI. This loan size is high-risk."*

### Feature 2: Fraud Detection & AML (Anti-Money Laundering)
**The Problem**: Alternative data (like invoices or GST filings) can be manipulated via circular trading or synthetic identities.
**The Feature**: The Rust ML pipeline adds heuristic anomaly detection. It flags suspicious patterns, such as 85% of revenue originating from a single, unverified GSTIN, or repetitive midnight UPI transfers. These "Risk Alerts" are presented prominently to the lender.

### Feature 3: Early Warning System (EWS) Webhooks
**The Problem**: Lenders care about a borrower's financial health *after* the loan is disbursed to prevent Non-Performing Assets (NPAs).
**The Feature**: Continuous monitoring. The Python API runs a weekly background task that checks the business's latest ingested data. If their revenue drops by >20% month-over-month, or if they miss a GST filing, the system fires an HTTP POST webhook directly to the bank's Loan Origination System (LOS) to trigger an early intervention.

### Feature 4: OCEN (Open Credit Enablement Network) Broadcast
**The Problem**: MSMEs currently have to apply to banks one by one.
**The Feature**: A "Broadcast to Lenders" button. The Python backend packages the Nexus Credit Passport (score, drivers, cash flow summary) into a standard OCEN Loan Application payload. It sends this to an OCEN Gateway, where multiple lenders bid on the loan, returning competing offers (e.g., SBI at 12%, HDFC at 14%) directly into the Nexus dashboard.

---

## 3. Seamless Ecosystem Integrations

To ensure zero-friction onboarding, V2 must integrate with the standard India Stack and ERP ecosystems:

1.  **DigiLocker / CKYC (Zero-Touch Onboarding)**: No manual typing. We fetch the business PAN, Udyam Certificate, and Director's Aadhaar automatically via DigiLocker APIs.
2.  **Tally ERP / Zoho Books**: Tally has a ~75% market share in India. The Go ingestion service must support parsing Tally XML ledger backups, giving the scoring engine deep visibility into Accounts Payable/Receivable.
3.  **Core Banking / LOS APIs**: On the lender side, the Nexus score and insights must be pushed directly via API into systems like FinnOne or Mambu, so bank managers don't have to log into a separate Nexus dashboard.
