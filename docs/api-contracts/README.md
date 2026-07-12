# API Contracts

Versioned OpenAPI specs and protobuf definitions.

## Structure

```
api-contracts/
├── v1/
│   ├── openapi.yaml       # FastAPI public API
│   ├── ingestion.proto    # gRPC for internal ingestion → scoring
│   └── webhooks.yaml      # Webhook payloads (Setu, GSTN, Razorpay)
└── README.md
```

## Versioning

- `v1` — Current development version
- Breaking changes → `v2` directory
- Deprecation policy: 3 months notice, both versions run in parallel

## Public API (FastAPI)

| Endpoint | Description | Auth |
|----------|-------------|------|
| `GET /healthz` | Health check | API Key |
| `POST /v1/consent/link` | Initiate AA consent flow | API Key |
| `GET /v1/consent/status/{request_id}` | Poll consent status | API Key |
| `POST /v1/accounts/{account_id}/sync` | Trigger ingestion sync | API Key |
| `GET /v1/accounts/{account_id}/score` | Get latest score + drivers | API Key |
| `POST /v1/shares` | Create scoped share link | API Key |
| `GET /v1/shares/{token}` | Resolve share token (lender view) | None (token in URL) |
| `DELETE /v1/shares/{token}` | Revoke share | API Key |

## Internal gRPC (Ingestion → Scoring)

```protobuf
service Scoring {
  rpc ScoreAccount(ScoreRequest) returns (ScoreResponse);
  rpc ExplainAccount(ExplainRequest) returns (ExplainResponse);
}
```

## Webhooks

| Source | Event | Payload Schema |
|--------|-------|----------------|
| Setu AA | `FI_DATA_READY` | `webhooks/setu.yaml` |
| GSTN | `GSTR_FILED` | `webhooks/gstn.yaml` |
| Razorpay | `PAYMENT_CAPTURED` | `webhooks/razorpay.yaml` |