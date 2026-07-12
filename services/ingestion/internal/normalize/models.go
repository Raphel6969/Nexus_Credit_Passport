package normalize

import (
	"time"

	"github.com/google/uuid"
)

// Business represents the core MSME entity owning the Passport.
type Business struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	PanHash   string    `json:"pan_hash" db:"pan_hash"`
	Gstin     *string   `json:"gstin" db:"gstin"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// Account represents a data source connected to the business.
type Account struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	BusinessID   uuid.UUID  `json:"business_id" db:"business_id"`
	SourceType   string     `json:"source_type" db:"source_type"` // e.g., "AA", "RAZORPAY"
	FIType       *string    `json:"fi_type" db:"fi_type"`         // Rebit FI Type, e.g., "DEPOSIT"
	AccountRef   string     `json:"account_ref" db:"account_ref"` // Masked or encrypted
	Status       string     `json:"status" db:"status"`           // "ACTIVE", "DISCONNECTED"
	LastSyncedAt *time.Time `json:"last_synced_at" db:"last_synced_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

// Counterparty represents an extracted entity the business transacts with.
type Counterparty struct {
	ID         uuid.UUID `json:"id" db:"id"`
	BusinessID uuid.UUID `json:"business_id" db:"business_id"`
	Name       *string   `json:"name" db:"name"`             // Asymmetrically encrypted string (Base64)
	Type       string    `json:"type" db:"type"`             // "SUPPLIER", "CUSTOMER"
	Identifier *string   `json:"identifier" db:"identifier"` // Asymmetrically encrypted string (Base64)
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// Transaction represents a raw normalized ledger entry.
type Transaction struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	AccountID       uuid.UUID  `json:"account_id" db:"account_id"`
	CounterpartyID  *uuid.UUID `json:"counterparty_id" db:"counterparty_id"`
	Amount          int64      `json:"amount" db:"amount"` // Minor units (paise)
	Currency        string     `json:"currency" db:"currency"`
	Type            string     `json:"type" db:"type"` // "CREDIT", "DEBIT"
	Timestamp       time.Time  `json:"timestamp" db:"timestamp"`
	Description     *string    `json:"description" db:"description"` // Asymmetrically encrypted string (Base64)
	ReferenceNumber *string    `json:"reference_number" db:"reference_number"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// CashFlowEvent represents a semantic event derived from transactions for ML scoring.
type CashFlowEvent struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	BusinessID    uuid.UUID  `json:"business_id" db:"business_id"`
	TransactionID *uuid.UUID `json:"transaction_id" db:"transaction_id"`
	EventType     string     `json:"event_type" db:"event_type"` // e.g., "INVOICE_PAID"
	Amount        int64      `json:"amount" db:"amount"`         // Minor units (paise)
	Currency      string     `json:"currency" db:"currency"`
	Timestamp     time.Time  `json:"timestamp" db:"timestamp"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}
