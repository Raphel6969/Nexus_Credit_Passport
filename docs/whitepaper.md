# Nexus Credit Passport — Whitepaper (Stub)

*Founder to fill in: market sizing, competitive landscape, architecture rationale, go-to-market, unit economics, regulatory roadmap, team, fundraising ask.*

---

## Problem

Indian MSMEs lack portable, verifiable credit identity. Lenders rely on fragmented, manual underwriting; MSMEs re-submit documents repeatedly.

## Solution

A portable "Credit Passport" — owned by the business, built on Account Aggregator (AA) framework + direct API integrations (GST, UPI, accounting, e-commerce). Normalized financial graph → explainable ML score → selectively, revocably shareable with lenders/suppliers/insurers.

## Architecture Overview

- **Ingestion** (Go): AA connectors (Setu, Perfios), GSTN, Razorpay, Tally/Zoho → normalized financial graph in Postgres
- **Scoring** (Rust, TEE-ready): XGBoost/CatBoost + SHAP on raw financial data; only service touching decrypted PII
- **API** (FastAPI): Consent/scope tokens, score delivery, share links, webhook callbacks
- **Web** (Next.js): Neumorphic dashboard — consent linking, score gauge, driver breakdown, share panel

## Trust Zones

| Zone | Services | Data Access |
|------|----------|-------------|
| Raw Zone (TEE) | Scoring (Rust) | Decrypted transactions, PII |
| Derived Zone | API (Python), Ingestion (Go) | Normalized graph, scores, explanations |
| Public Zone | Web (Next.js) | Consented views, share links |

## Roadmap

1. **Phase 0** — Repo skeleton, CI, local stack
2. **Phase 1** — Financial graph schema (ADR)
3. **Phase 2** — Vertical slice: Setu AA sandbox → Postgres → Rust scoring → FastAPI → raw number on web
4. **Phase 3** — GSTN, Razorpay, Tally connectors
5. **Phase 4** — Real XGBoost + SHAP on proxy MSME data
6. **Phase 5** — Scoped revocable tokens (full/score-only/one-time)
7. **Phase 6** — Neumorphic dashboard
8. **Phase 7** — Hardening, auth gate, rate limits, demo seed data

## Key Differentiators

- **Portable**: Business owns the passport, not the lender
- **Explainable**: Every score driver human-readable (SHAP)
- **Revocable**: Scope-limited, time-bounded, auditable access
- **AA-native**: Built on India's Account Aggregator rails from day one

## Open Questions

- [ ] AA partner: Setu vs Perfios vs direct Sahamati?
- [ ] Scoring data: Public MSME proxies vs synthetic vs partner pilot data?
- [ ] TEE deployment: AWS Nitro Enclaves vs GCP Confidential VMs vs Azure Confidential?
- [ ] Regulatory: RBI PA/PG license path vs AA-only path?