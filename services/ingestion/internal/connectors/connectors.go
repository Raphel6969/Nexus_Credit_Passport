package connectors

import (
	"context"
)

// SourceConnector is the interface every data-source adapter must implement.
// Sync returns common normalized structs with PLAINTEXT PII fields.
// The orchestrator applies pii.ProcessAll() uniformly after Sync() returns.
type SourceConnector interface {
	Name() string // "setu_aa", "gstn", "razorpay", "zoho_books"
	Sync(ctx context.Context, req SyncRequest) (*SyncResult, error)
}

// SyncRequest carries the parameters needed by any connector to fetch data.
type SyncRequest struct {
	BusinessID string
	AccountID  string
	AuthConfig map[string]string // connector-specific creds from env
}

// SyncResult holds the normalized output from any connector.
// All PII fields are PLAINTEXT at this point — the orchestrator seals them.
type SyncResult struct {
	AccountUpdate  *RawAccountUpdate
	Transactions   []RawTransaction
	Counterparties []RawCounterparty
	TaxFilings     []RawTaxFiling
	Invoices       []RawInvoice
	RawPayloads    []RawPayload // full API response blobs for audit/debug
}

// RawAccountUpdate carries account summary changes from a sync.
type RawAccountUpdate struct {
	AccountID           string
	BusinessID          string
	SourceType          string  // AA / GSTN / RAZORPAY / ZOHO
	MaskedAccountNumber string
	AccountType         string  // SAVINGS / CURRENT / OVERDRAFT
	IFSCCode            string
	Balance             *int64  // paise
	BalanceAt           string  // ISO 8601
}

// RawTransaction is the canonical intermediate representation produced by any
// connector before PII sealing. All PII fields are plaintext.
// Amount is a float (as received from APIs) — normalization converts to paise.
type RawTransaction struct {
	ExternalID           string         // Source's txnId — used to compute HMAC blind index
	ExternalIDHMAC       string         // Populated by pii.ComputeBlindIndexes()
	Type                 string         // CREDIT / DEBIT
	Mode                 string         // UPI / NEFT / RTGS / IMPS / NACH / RAZORPAY / RAZORPAY_SETTLEMENT / GST_FILING / ZOHO
	Amount               float64        // Positive float from API — normalization converts × 100 → int64
	Currency             string         // ISO 4217, usually "INR"
	TransactionalBalance *float64       // Running balance after txn
	TransactionTimestamp string         // ISO 8601 datetime string from API
	ValueDate            string         // YYYY-MM-DD settlement date
	Narration            string         // Raw narration — PLAINTEXT here, sealed by pii.SealFields()
	Reference            string         // UTR / cheque / reference number
	RevenueRole          string         // primary / informational / tax_summary
	RawPayload           map[string]any // Full original JSON — for debugging
}

// RawCounterparty is a counterparty extracted by any connector with plaintext PII.
type RawCounterparty struct {
	Name           string // PLAINTEXT — sealed by pii.SealFields()
	Type           string // SUPPLIER / CUSTOMER / LENDER / UNKNOWN
	Identifier     string // PLAINTEXT VPA/GSTIN/email — sealed by pii.SealFields()
	IdentifierType string // VPA / GSTIN / ACCOUNT_IFSC / PAN / PHONE / EMAIL
	IdentifierHMAC string // Populated by pii.ComputeBlindIndexes()
	SourceType     string // AA / GSTN / RAZORPAY / ZOHO
}

// RawTaxFiling is a GST return summary from the GSTN connector.
type RawTaxFiling struct {
	ReturnType     string // GSTR3B / GSTR1 / GSTR2A
	Period         string // "2025-06" (YYYY-MM)
	GrossTurnover  *int64 // paise
	TaxPaid        *int64 // paise
	FilingDate     string // YYYY-MM-DD
	Status         string // FILED / PENDING / LATE
}

// RawInvoice is an invoice/bill from the Zoho Books connector.
type RawInvoice struct {
	ExternalID     string // Zoho invoice ID — used to compute HMAC blind index
	ExternalIDHMAC string // Populated by pii.ComputeBlindIndexes()
	InvoiceType    string // RECEIVABLE / PAYABLE
	Amount         float64
	Currency       string
	IssueDate      string // YYYY-MM-DD
	DueDate        string // YYYY-MM-DD
	PaidDate       string // YYYY-MM-DD
	Status         string // DRAFT / SENT / OVERDUE / PAID / VOID
}

// RawPayload carries an arbitrary JSON blob that needs sealing before storage.
// The orchestrator calls pii.SealBlob() on each before writing to the DB.
type RawPayload struct {
	TargetTable string // "tax_filings" — tells the store which table to write to
	TargetID    string // FK row ID
	FieldName   string // "raw_data_sealed"
	Plaintext   []byte // raw JSON — will be age-encrypted by orchestrator
	Sealed      string // Populated by pii.SealBlob() — base64 age ciphertext
}