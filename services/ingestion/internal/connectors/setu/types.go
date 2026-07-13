// Rebit AA v2.0.0 type definitions for the Setu FIU API.
//
// Field names match the exact JSON structure returned by GET /sessions/{id}.
// Amounts are float64 as returned by the API — normalizer converts to int64 paise.
// Reference: https://api.rebit.org.in and Setu AA documentation.
package setu

// ── Consent ───────────────────────────────────────────────────────────────────

// ConsentRequest is the body for POST /consents.
type ConsentRequest struct {
	Ver           string        `json:"ver"`
	Timestamp     string        `json:"timestamp"`
	TxnID         string        `json:"txnid"`
	ConsentDetail ConsentDetail `json:"ConsentDetail"`
}

// ConsentDetail contains the full consent specification.
type ConsentDetail struct {
	ConsentStart  string       `json:"consentStart"`
	ConsentExpiry string       `json:"consentExpiry"`
	ConsentMode   string       `json:"consentMode"`   // STORE
	FetchType     string       `json:"fetchType"`     // PERIODIC
	ConsentTypes  []string     `json:"consentTypes"`  // ["PROFILE","SUMMARY","TRANSACTIONS"]
	FITypes       []string     `json:"fiTypes"`       // ["DEPOSIT"]
	DataConsumer  DataConsumer `json:"DataConsumer"`
	Customer      Customer     `json:"Customer"`
	Purpose       Purpose      `json:"Purpose"`
	FIDataRange   DateRange    `json:"FIDataRange"`
	DataLife      TimeUnit     `json:"DataLife"`
	Frequency     TimeUnit     `json:"Frequency"`
}

// DataConsumer is the FIU entity.
type DataConsumer struct {
	ID   string `json:"id"`
	Type string `json:"type"` // FIU
}

// Customer identifies the AA user.
type Customer struct {
	ID          string       `json:"id"`
	Identifiers []Identifier `json:"Identifiers"`
}

// Identifier is a customer identifier (MOBILE, PAN, etc.).
type Identifier struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

// Purpose is the consent purpose per ReBIT spec.
type Purpose struct {
	Code     string          `json:"code"`
	RefURI   string          `json:"refUri"`
	Text     string          `json:"text"`
	Category PurposeCategory `json:"Category"`
}

// PurposeCategory groups consent purposes.
type PurposeCategory struct {
	Type string `json:"type"`
}

// DateRange represents a from/to date range.
type DateRange struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// TimeUnit represents a duration (e.g. DataLife, Frequency).
type TimeUnit struct {
	Unit  string `json:"unit"`  // YEAR / MONTH / DAY / HOUR
	Value int    `json:"value"`
}

// ConsentResponse is returned by POST /consents (201 Created).
type ConsentResponse struct {
	ID     string `json:"id"`     // consentId / consentHandle
	Status string `json:"status"` // PENDING
	URL    string `json:"url"`    // Redirect URL for user consent
}

// ConsentStatusResponse is returned by GET /consents/{id}.
type ConsentStatusResponse struct {
	ID     string      `json:"id"`
	Status string      `json:"status"` // PENDING / ACTIVE / REVOKED / EXPIRED / REJECTED
	Detail interface{} `json:"detail,omitempty"`
}

// ── Sessions ──────────────────────────────────────────────────────────────────

// SessionRequest is the body for POST /sessions.
type SessionRequest struct {
	ConsentID string    `json:"consentId"`
	DataRange DateRange `json:"dataRange"`
	Format    string    `json:"format"` // json
}

// SessionResponse is returned by POST /sessions (201 Created).
type SessionResponse struct {
	ID        string    `json:"id"`
	Status    string    `json:"status"` // PENDING / COMPLETED / PARTIAL / FAILED
	ConsentID string    `json:"consentId"`
	Format    string    `json:"format"`
	DataRange DateRange `json:"dataRange"`
	TraceID   string    `json:"traceId"`
}

// FIDataResponse is returned by GET /sessions/{id} once COMPLETED.
type FIDataResponse struct {
	Ver       string   `json:"ver"`
	Timestamp string   `json:"timestamp"`
	TxnID     string   `json:"txnid"`
	FI        []FIPData `json:"FI"`
}

// FIPData groups accounts from a single FIP.
type FIPData struct {
	FIPID string      `json:"fipID"`
	Data  []FIAccount `json:"data"`
}

// FIAccount is a single linked account with its Profile, Summary, and Transactions.
type FIAccount struct {
	LinkRefNumber    string    `json:"linkRefNumber"`
	MaskedAccNumber  string    `json:"maskedAccNumber"`
	Account          AAAccount `json:"account"`
}

// AAAccount is the decoded FI data for a DEPOSIT account.
type AAAccount struct {
	Type         string        `json:"type"`    // deposit
	Profile      *AAProfile    `json:"Profile,omitempty"`
	Summary      *AASummary    `json:"Summary,omitempty"`
	Transactions *AATransactions `json:"Transactions,omitempty"`
}

// AAProfile contains holder information.
type AAProfile struct {
	Holders AAHolders `json:"Holders"`
}

// AAHolders contains all account holders.
type AAHolders struct {
	Type   string     `json:"type"` // SINGLE / JOINT
	Holder []AAHolder `json:"Holder"`
}

// AAHolder is an individual account holder.
type AAHolder struct {
	Name           string `json:"name"`
	DOB            string `json:"dob"`
	Mobile         string `json:"mobile"`
	Email          string `json:"email"`
	PAN            string `json:"pan"`
	Nominee        string `json:"nominee"`
	CKYCCompliance bool   `json:"ckycCompliance"`
}

// AASummary contains the current account summary from the FIP.
type AASummary struct {
	CurrentBalance  float64   `json:"currentBalance"`
	Currency        string    `json:"currency"`
	BalanceDateTime string    `json:"balanceDateTime"`
	Type            string    `json:"type"`       // SAVINGS / CURRENT / OVERDRAFT
	Branch          string    `json:"branch"`
	Facility        string    `json:"facility"`   // OD etc.
	IFSCCode        string    `json:"ifscCode"`
	MICRCode        string    `json:"micrCode"`
	OpeningDate     string    `json:"openingDate"`
	Status          string    `json:"status"`     // ACTIVE / INACTIVE / DORMANT
}

// AATransactions is the transaction list from the FIP.
type AATransactions struct {
	StartDate   string          `json:"startDate"`
	EndDate     string          `json:"endDate"`
	Transaction []AATransaction `json:"Transaction"`
}

// AATransaction is a single transaction per Rebit AA v2.0.0 schema.
// Mode values: UPI / NEFT / RTGS / IMPS / NACH / ATM / CARD / CHEQUE / ECS / CASH / OTHERS
type AATransaction struct {
	TxnID                 string   `json:"txnId"`
	Type                  string   `json:"type"`                  // CREDIT / DEBIT
	Mode                  string   `json:"mode"`                  // UPI / NEFT / RTGS / IMPS / NACH / ATM / CARD / CHEQUE / ECS / OTHERS
	Amount                float64  `json:"amount"`
	TransactionalBalance  *float64 `json:"transactionalBalance,omitempty"`
	TransactionTimestamp  string   `json:"transactionTimestamp"`
	ValueDate             string   `json:"valueDate"`
	Narration             string   `json:"narration"`
	Reference             string   `json:"reference"`
}
