// Package normalize converts raw Setu AA FI data into the normalized financial graph
// structures ready for database insertion.
//
// Rules:
//   - Amounts: float64 × 100 → int64 paise (round to avoid float drift)
//   - Timestamps: parsed from ISO 8601, treated as IST if no timezone
//   - PII fields (narration, counterparty name/identifier): sealed before returning
//   - external_id_hmac: HMAC blind index computed from FIP's txnId
package normalize

import (
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/nexus-credit-passport/ingestion/internal/connectors/setu"
	"github.com/nexus-credit-passport/ingestion/internal/crypto"
)

// IST is the India Standard Time location (UTC+5:30).
var IST = mustLoadLocation("Asia/Kolkata")

func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		// Fallback to fixed offset if tzdata not available
		return time.FixedZone("IST", 5*60*60+30*60)
	}
	return loc
}

// Normalizer converts Setu AA data into normalized DB-ready structs.
// It holds the crypto tools so they're initialized once and reused.
type Normalizer struct {
	sealer  *crypto.Sealer
	hmac    *crypto.BlindIndex
}

// NewNormalizer creates a Normalizer with crypto tools loaded from environment.
func NewNormalizer() (*Normalizer, error) {
	sealer, err := crypto.NewSealerFromEnv()
	if err != nil {
		return nil, fmt.Errorf("init sealer: %w", err)
	}
	hmac, err := crypto.NewBlindIndexFromEnv()
	if err != nil {
		return nil, fmt.Errorf("init hmac: %w", err)
	}
	return &Normalizer{sealer: sealer, hmac: hmac}, nil
}

// NormalizeResult holds the output of normalizing one FI account.
type NormalizeResult struct {
	AccountUpdate  Account
	Transactions   []Transaction
	Counterparties []Counterparty
}

// NormalizeFIAccount converts a Setu FIAccount into DB-ready normalized structs.
// businessID and accountID are the UUIDs of the owning business and account row.
func (n *Normalizer) NormalizeFIAccount(
	fiAccount setu.FIAccount,
	businessID, accountID string,
) (*NormalizeResult, error) {
	result := &NormalizeResult{}

	acc := fiAccount.Account

	// ── Account summary update ─────────────────────────────────────────────────
	accountUpdate := Account{
		ID:                  accountID,
		BusinessID:          businessID,
		SourceType:          "AA",
		MaskedAccountNumber: strPtr(fiAccount.MaskedAccNumber),
	}
	if acc.Summary != nil {
		s := acc.Summary
		balancePaise := int64(math.Round(s.CurrentBalance * 100))
		accountUpdate.Balance = &balancePaise
		accountUpdate.AccountType = strPtr(s.Type) // SAVINGS / CURRENT / OVERDRAFT
		accountUpdate.IFSCCode = strPtr(s.IFSCCode)
		if s.BalanceDateTime != "" {
			t, err := parseTimestamp(s.BalanceDateTime)
			if err == nil {
				accountUpdate.BalanceAt = &t
			}
		}
	}
	result.AccountUpdate = accountUpdate

	// ── Transactions ──────────────────────────────────────────────────────────
	if acc.Transactions == nil {
		return result, nil
	}

	currency := "INR"
	if acc.Summary != nil && acc.Summary.Currency != "" {
		currency = acc.Summary.Currency
	}

	// Counterparty dedup within this batch (VPA → counterparty ID)
	vpaToCounterpartyID := make(map[string]string)

	for _, raw := range acc.Transactions.Transaction {
		txn, counterparty, err := n.normalizeTransaction(raw, businessID, accountID, currency, vpaToCounterpartyID)
		if err != nil {
			return nil, fmt.Errorf("normalize txn %s: %w", raw.TxnID, err)
		}
		result.Transactions = append(result.Transactions, txn)
		if counterparty != nil {
			// Only add if this counterparty hasn't been seen yet in this batch
			if _, seen := vpaToCounterpartyID[*counterparty.Identifier]; !seen {
				vpaToCounterpartyID[*counterparty.Identifier] = counterparty.ID
				result.Counterparties = append(result.Counterparties, *counterparty)
			}
		}
	}

	return result, nil
}

// normalizeTransaction converts a single Rebit AA transaction into a DB-ready Transaction.
func (n *Normalizer) normalizeTransaction(
	raw setu.AATransaction,
	businessID, accountID, currency string,
	vpaIndex map[string]string,
) (Transaction, *Counterparty, error) {
	// Amount: float64 → int64 paise
	amountPaise := int64(math.Round(raw.Amount * 100))

	// Balance: float64 → int64 paise
	var balancePaise *int64
	if raw.TransactionalBalance != nil {
		b := int64(math.Round(*raw.TransactionalBalance * 100))
		balancePaise = &b
	}

	// Timestamp: parse from ISO 8601, apply IST if no timezone
	ts, err := parseTimestamp(raw.TransactionTimestamp)
	if err != nil {
		return Transaction{}, nil, fmt.Errorf("parse timestamp: %w", err)
	}

	// HMAC blind index for external txnId (dedup)
	hmacVal := n.hmac.Hash(raw.TxnID)
	hmacPtr := &hmacVal

	// Seal narration (PII — contains VPA, account numbers, personal refs)
	sealedNarration, err := n.sealer.SealOptional(strPtr(raw.Narration))
	if err != nil {
		return Transaction{}, nil, fmt.Errorf("seal narration: %w", err)
	}

	txn := Transaction{
		ID:                   uuid.New().String(),
		AccountID:            accountID,
		Amount:               amountPaise,
		Currency:             coalesce(currency, "INR"),
		TransactionalBalance: balancePaise,
		Type:                 raw.Type,
		Mode:                 raw.Mode,
		Timestamp:            ts,
		ExternalIDHMAC:       hmacPtr,
		Narration:            sealedNarration,
		ReferenceNumber:      strPtr(raw.Reference),
	}

	if raw.ValueDate != "" {
		txn.ValueDate = strPtr(raw.ValueDate)
	}

	// ── Counterparty extraction (UPI only for now) ─────────────────────────────
	var counterparty *Counterparty
	if raw.Mode == "UPI" {
		vpa := ExtractVPA(raw.Narration)
		if vpa != "" {
			if existingID, seen := vpaIndex[vpa]; seen {
				txn.CounterpartyID = &existingID
			} else {
				cp, err := n.buildCounterparty(businessID, vpa, raw.Type)
				if err != nil {
					return Transaction{}, nil, fmt.Errorf("build counterparty: %w", err)
				}
				txn.CounterpartyID = &cp.ID
				counterparty = cp
			}
		}
	}

	return txn, counterparty, nil
}

// buildCounterparty creates a Counterparty from a UPI VPA, with PII sealed.
func (n *Normalizer) buildCounterparty(businessID, vpa, txnType string) (*Counterparty, error) {
	cpType := "CUSTOMER"
	if txnType == "DEBIT" {
		cpType = "SUPPLIER"
	}

	sealedVPA, err := n.sealer.Seal(vpa)
	if err != nil {
		return nil, fmt.Errorf("seal VPA: %w", err)
	}

	identifierType := "VPA"
	return &Counterparty{
		ID:             uuid.New().String(),
		BusinessID:     businessID,
		Type:           cpType,
		Identifier:     &sealedVPA,
		IdentifierType: &identifierType,
	}, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// parseTimestamp parses an ISO 8601 datetime string.
// If no timezone is specified, assumes IST (UTC+5:30).
func parseTimestamp(s string) (time.Time, error) {
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05.000Z",
		"2006-01-02T15:04:05.000",
	}
	for _, f := range formats {
		t, err := time.ParseInLocation(f, s, IST)
		if err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse timestamp %q", s)
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func coalesce(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
