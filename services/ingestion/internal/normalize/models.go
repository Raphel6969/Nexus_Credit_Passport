package normalize

import "time"

// Business represents the core MSME entity owning the Passport.
type Business struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	PanHash   string    `json:"pan_hash" db:"pan_hash"`
	Gstin     *string   `json:"gstin,omitempty" db:"gstin"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// Account represents a data source connected to the business.
// source_type: AA / RAZORPAY / GSTN / ZOHO
// fi_type:     Rebit FI Type string e.g. DEPOSIT / TERM_DEPOSIT / RECURRING_DEPOSIT
type Account struct {
	ID           string     `json:"id" db:"id"`
	BusinessID   string     `json:"business_id" db:"business_id"`
	SourceType   string     `json:"source_type" db:"source_type"`
	FIType       *string    `json:"fi_type,omitempty" db:"fi_type"`
	AccountRef   string     `json:"account_ref" db:"account_ref"`
	Status       string     `json:"status" db:"status"`
	LastSyncedAt *time.Time `json:"last_synced_at,omitempty" db:"last_synced_at"`
	// From AA Summary block
	MaskedAccountNumber *string    `json:"masked_account_number,omitempty" db:"masked_account_number"`
	AccountType         *string    `json:"account_type,omitempty" db:"account_type"` // SAVINGS/CURRENT/OVERDRAFT/CC
	IFSCCode            *string    `json:"ifsc_code,omitempty" db:"ifsc_code"`
	Balance             *int64     `json:"balance,omitempty" db:"balance"` // paise
	BalanceAt           *time.Time `json:"balance_at,omitempty" db:"balance_at"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
}

// Counterparty represents an extracted entity the business transacts with.
// name and identifier are asymmetrically encrypted (age sealed-box, base64).
type Counterparty struct {
	ID             string  `json:"id" db:"id"`
	BusinessID     string  `json:"business_id" db:"business_id"`
	Name           *string `json:"name,omitempty" db:"name"`                       // ENCRYPTED
	Type           string  `json:"type" db:"type"`                                 // SUPPLIER / CUSTOMER / LENDER / UNKNOWN
	Identifier     *string `json:"identifier,omitempty" db:"identifier"`           // ENCRYPTED
	IdentifierType *string `json:"identifier_type,omitempty" db:"identifier_type"` // VPA / GSTIN / ACCOUNT_IFSC / PAN / PHONE / EMAIL
	IdentifierHMAC *string `json:"identifier_hmac,omitempty" db:"identifier_hmac"` // Blind index for cross-source resolution
	SourceType     *string `json:"source_type,omitempty" db:"source_type"`         // AA / GSTN / RAZORPAY / ZOHO
	CreatedAt      string  `json:"created_at" db:"created_at"`
	UpdatedAt      string  `json:"updated_at" db:"updated_at"`
}

// Transaction is a single normalized ledger entry ready for DB insertion.
// narration and description are asymmetrically encrypted (age sealed-box, base64).
// external_id_hmac is HMAC-SHA256(hmac_key, fip_txnId) — used for dedup, not PII.
type Transaction struct {
	ID             string  `json:"id" db:"id"`
	AccountID      string  `json:"account_id" db:"account_id"`
	CounterpartyID *string `json:"counterparty_id,omitempty" db:"counterparty_id"`
	// Amounts — always in paise (minor units)
	Amount               int64  `json:"amount" db:"amount"`
	Currency             string `json:"currency" db:"currency"`
	TransactionalBalance *int64 `json:"transactional_balance,omitempty" db:"transactional_balance"`
	// Rebit AA core fields
	Type      string    `json:"type" db:"type"`                       // CREDIT / DEBIT
	Mode      string    `json:"mode" db:"mode"`                       // UPI / NEFT / RTGS / IMPS / NACH / RAZORPAY / GST_FILING / ZOHO
	Timestamp time.Time `json:"timestamp" db:"timestamp"`             // transactionTimestamp
	ValueDate *string   `json:"value_date,omitempty" db:"value_date"` // YYYY-MM-DD
	// PII — ENCRYPTED (age sealed-box, base64)
	Narration   *string `json:"narration,omitempty" db:"narration"`
	Description *string `json:"description,omitempty" db:"description"`
	// Dedup blind index
	ExternalIDHMAC  *string `json:"external_id_hmac,omitempty" db:"external_id_hmac"`
	ReferenceNumber *string `json:"reference_number,omitempty" db:"reference_number"`
	// Revenue double-counting prevention (Phase 3)
	RevenueRole string    `json:"revenue_role" db:"revenue_role"` // primary / informational / tax_summary
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// TaxFiling represents a GST return summary from the GSTN connector.
type TaxFiling struct {
	ID            string    `json:"id" db:"id"`
	BusinessID    string    `json:"business_id" db:"business_id"`
	ReturnType    string    `json:"return_type" db:"return_type"`                 // GSTR3B / GSTR1 / GSTR2A
	Period        string    `json:"period" db:"period"`                           // "2025-06" (YYYY-MM)
	GrossTurnover *int64    `json:"gross_turnover,omitempty" db:"gross_turnover"` // paise
	TaxPaid       *int64    `json:"tax_paid,omitempty" db:"tax_paid"`             // paise
	FilingDate    *string   `json:"filing_date,omitempty" db:"filing_date"`
	Status        string    `json:"status" db:"status"`                             // FILED / PENDING / LATE
	RawDataSealed *string   `json:"raw_data_sealed,omitempty" db:"raw_data_sealed"` // age-encrypted
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// Invoice represents an AR/AP invoice from the Zoho Books connector.
type Invoice struct {
	ID             string    `json:"id" db:"id"`
	BusinessID     string    `json:"business_id" db:"business_id"`
	CounterpartyID *string   `json:"counterparty_id,omitempty" db:"counterparty_id"`
	ExternalIDHMAC *string   `json:"external_id_hmac,omitempty" db:"external_id_hmac"`
	InvoiceType    string    `json:"invoice_type" db:"invoice_type"` // RECEIVABLE / PAYABLE
	Amount         int64     `json:"amount" db:"amount"`             // paise
	Currency       string    `json:"currency" db:"currency"`
	IssueDate      string    `json:"issue_date" db:"issue_date"`
	DueDate        *string   `json:"due_date,omitempty" db:"due_date"`
	PaidDate       *string   `json:"paid_date,omitempty" db:"paid_date"`
	Status         string    `json:"status" db:"status"` // DRAFT / SENT / OVERDUE / PAID / VOID
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// CashFlowEvent is a semantic event derived from transactions for ML scoring.
type CashFlowEvent struct {
	ID            string    `json:"id" db:"id"`
	BusinessID    string    `json:"business_id" db:"business_id"`
	TransactionID *string   `json:"transaction_id,omitempty" db:"transaction_id"`
	EventType     string    `json:"event_type" db:"event_type"` // INVOICE_PAID / EMI_DEBIT / SALARY_CREDIT / etc.
	Amount        int64     `json:"amount" db:"amount"`
	Currency      string    `json:"currency" db:"currency"`
	Timestamp     time.Time `json:"timestamp" db:"timestamp"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}
