// Package orchestrator provides the central ingestion pipeline.
//
// All connectors funnel through orchestrator.Run():
//
//	connector.Sync() → pii.ProcessAll() → store.Upsert*()
//
// This guarantees:
//   - PII sealing happens in one place (pii package), same key, all sources.
//   - Blind indexes are computed before sealing (needs plaintext).
//   - Raw audit blobs are sealed alongside transactions/counterparties.
//   - Revenue role tagging is validated before DB write.
package orchestrator

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nexus-credit-passport/ingestion/internal/connectors"
	"github.com/nexus-credit-passport/ingestion/internal/normalize"
	"github.com/nexus-credit-passport/ingestion/internal/pii"
	"github.com/nexus-credit-passport/ingestion/internal/store"
)

// Result holds the counts from a single connector run.
type Result struct {
	Source               string `json:"source"`
	TransactionsInserted int    `json:"transactionsInserted"`
	TransactionsSkipped  int    `json:"transactionsSkipped"`
	CounterpartiesStored int    `json:"counterpartiesStored"`
	TaxFilingsStored     int    `json:"taxFilingsStored"`
	InvoicesStored       int    `json:"invoicesStored"`
}

// Orchestrator runs the ingestion pipeline for any connector.
type Orchestrator struct {
	pii   *pii.Processor
	store *store.PGStore
}

// New creates an Orchestrator with PII processor and DB store.
func New(p *pii.Processor, s *store.PGStore) *Orchestrator {
	return &Orchestrator{pii: p, store: s}
}

// Run executes the full pipeline for a given connector.
func (o *Orchestrator) Run(ctx context.Context, connector connectors.SourceConnector, req connectors.SyncRequest) (*Result, error) {
	// 1. Fetch raw data from source
	syncResult, err := connector.Sync(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("%s sync: %w", connector.Name(), err)
	}

	// 2. PII processing: blind indexes (on plaintext) → seal fields → seal blobs
	if err := o.pii.ProcessAll(syncResult); err != nil {
		return nil, fmt.Errorf("%s pii: %w", connector.Name(), err)
	}

	result := &Result{Source: connector.Name()}
	now := time.Now().UTC()

	// 3. Upsert account update if present
	if syncResult.AccountUpdate != nil {
		au := syncResult.AccountUpdate
		acc := normalize.Account{
			ID:                  au.AccountID,
			BusinessID:          au.BusinessID,
			SourceType:          au.SourceType,
			AccountRef:          au.AccountID, // use account ID as ref
			Status:              "ACTIVE",
			MaskedAccountNumber: strPtr(au.MaskedAccountNumber),
			AccountType:         strPtr(au.AccountType),
			IFSCCode:            strPtr(au.IFSCCode),
			Balance:             au.Balance,
		}
		if au.BalanceAt != "" {
			t, err := time.Parse(time.RFC3339, au.BalanceAt)
			if err == nil {
				acc.BalanceAt = &t
			}
		}
		if err := o.store.UpsertAccount(ctx, acc); err != nil {
			log.Printf("orchestrator: upsert account: %v", err)
		}
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	// 4. Upsert counterparties
	wg.Add(1)
	go func() {
		defer wg.Done()
		var stored int
		for _, cp := range syncResult.Counterparties {
			cpID := uuid.New().String()
			dbCP := normalize.Counterparty{
				ID:             cpID,
				BusinessID:     req.BusinessID,
				Name:           strPtr(cp.Name),
				Type:           cp.Type,
				Identifier:     strPtr(cp.Identifier),
				IdentifierType: strPtr(cp.IdentifierType),
				IdentifierHMAC: strPtr(cp.IdentifierHMAC),
				SourceType:     strPtr(cp.SourceType),
			}
			if err := o.store.UpsertCounterparty(ctx, dbCP); err != nil {
				log.Printf("orchestrator: upsert counterparty: %v", err)
				continue
			}
			stored++
		}
		mu.Lock()
		result.CounterpartiesStored += stored
		mu.Unlock()
	}()

	// 5. Upsert transactions
	wg.Add(1)
	go func() {
		defer wg.Done()
		var inserted, skipped int
		for _, txn := range syncResult.Transactions {
			ts, err := parseTimestamp(txn.TransactionTimestamp)
			if err != nil {
				log.Printf("orchestrator: parse txn timestamp %q: %v", txn.TransactionTimestamp, err)
				continue
			}

			amountPaise := int64(txn.Amount * 100)
			var balPaise *int64
			if txn.TransactionalBalance != nil {
				b := int64(*txn.TransactionalBalance * 100)
				balPaise = &b
			}

			revenueRole := txn.RevenueRole
			if revenueRole == "" {
				revenueRole = "primary"
			}

			dbTxn := normalize.Transaction{
				ID:                   uuid.New().String(),
				AccountID:            req.AccountID,
				Amount:               amountPaise,
				Currency:             coalesce(txn.Currency, "INR"),
				TransactionalBalance: balPaise,
				Type:                 txn.Type,
				Mode:                 txn.Mode,
				Timestamp:            ts,
				ValueDate:            strPtr(txn.ValueDate),
				Narration:            strPtr(txn.Narration),
				ExternalIDHMAC:       strPtr(txn.ExternalIDHMAC),
				ReferenceNumber:      strPtr(txn.Reference),
				RevenueRole:          revenueRole,
			}
			ins, err := o.store.UpsertTransaction(ctx, dbTxn)
			if err != nil {
				log.Printf("orchestrator: upsert txn: %v", err)
				continue
			}
			if ins {
				inserted++
			} else {
				skipped++
			}
		}
		mu.Lock()
		result.TransactionsInserted += inserted
		result.TransactionsSkipped += skipped
		mu.Unlock()
	}()

	// 6. Upsert tax filings
	wg.Add(1)
	go func() {
		defer wg.Done()
		var stored int
		for i, tf := range syncResult.TaxFilings {
			var sealedData *string
			// Find the matching sealed blob
			for _, rp := range syncResult.RawPayloads {
				if rp.TargetTable == "tax_filings" && rp.TargetID == tf.Period {
					if rp.Sealed != "" {
						sealedData = &rp.Sealed
					}
					break
				}
			}
			dbTF := normalize.TaxFiling{
				ID:            uuid.New().String(),
				BusinessID:    req.BusinessID,
				ReturnType:    tf.ReturnType,
				Period:        tf.Period,
				GrossTurnover: tf.GrossTurnover,
				TaxPaid:       tf.TaxPaid,
				FilingDate:    strPtr(tf.FilingDate),
				Status:        tf.Status,
				RawDataSealed: sealedData,
				CreatedAt:     now,
				UpdatedAt:     now,
			}
			if err := o.store.UpsertTaxFiling(ctx, dbTF); err != nil {
				log.Printf("orchestrator: upsert tax filing[%d]: %v", i, err)
				continue
			}
			stored++
		}
		mu.Lock()
		result.TaxFilingsStored += stored
		mu.Unlock()
	}()

	// 7. Upsert invoices
	wg.Add(1)
	go func() {
		defer wg.Done()
		var stored int
		for i, inv := range syncResult.Invoices {
			amountPaise := int64(inv.Amount * 100)
			dbInv := normalize.Invoice{
				ID:             uuid.New().String(),
				BusinessID:     req.BusinessID,
				ExternalIDHMAC: strPtr(inv.ExternalIDHMAC),
				InvoiceType:    inv.InvoiceType,
				Amount:         amountPaise,
				Currency:       coalesce(inv.Currency, "INR"),
				IssueDate:      inv.IssueDate,
				DueDate:        strPtr(inv.DueDate),
				PaidDate:       strPtr(inv.PaidDate),
				Status:         inv.Status,
				CreatedAt:      now,
				UpdatedAt:      now,
			}
			if err := o.store.UpsertInvoice(ctx, dbInv); err != nil {
				log.Printf("orchestrator: upsert invoice[%d]: %v", i, err)
				continue
			}
			stored++
		}
		mu.Lock()
		result.InvoicesStored += stored
		mu.Unlock()
	}()

	wg.Wait()
	return result, nil
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func parseTimestamp(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, fmt.Errorf("empty timestamp")
	}
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05.000Z",
		"2006-01-02T15:04:05.000",
		"2006-01-02",
	}
	ist := time.FixedZone("IST", 5*60*60+30*60)
	for _, f := range formats {
		t, err := time.ParseInLocation(f, s, ist)
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
