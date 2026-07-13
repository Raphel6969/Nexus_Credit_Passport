package connectors

import (
	"context"
	"time"
)

// Connector is the interface every data-source adapter must implement.
// Fetch returns raw transactions for a given account since the given time.
type Connector interface {
	Fetch(ctx context.Context, accountID string, since time.Time) ([]RawTransaction, error)
	Name() string
}

// RawTransaction is the canonical intermediate representation produced by any
// connector before normalization. All fields use the Rebit AA v2.0.0 names.
// Amount is a float (as received from AA APIs) — normalization converts to paise.
type RawTransaction struct {
	ExternalID           string             // FIP's txnId — used to compute HMAC blind index
	Type                 string             // CREDIT / DEBIT
	Mode                 string             // UPI / NEFT / RTGS / IMPS / NACH / ATM / CARD / CHEQUE / ECS / OTHERS
	Amount               float64            // Positive float from AA — normalization converts × 100 → int64
	Currency             string             // ISO 4217, usually "INR"
	TransactionalBalance *float64           // Running balance after txn (AA v2.0.0)
	TransactionTimestamp string             // ISO 8601 datetime string from API
	ValueDate            string             // YYYY-MM-DD settlement date
	Narration            string             // Raw bank narration — will be encrypted before DB write
	Reference            string             // UTR / cheque / reference number
	RawPayload           map[string]any     // Full original JSON — for debugging
}