// Package setu_adapter wraps the existing Setu AA client as a SourceConnector.
//
// This adapter converts the Setu client's FIData response into the common
// RawTransaction/RawCounterparty structs that the orchestrator expects.
// PII fields (narration, VPA) are returned as PLAINTEXT — the orchestrator
// seals them via pii.ProcessAll().
package setu

import (
	"context"
	"fmt"
	"time"

	"github.com/nexus-credit-passport/ingestion/internal/connectors"
	"github.com/nexus-credit-passport/ingestion/internal/normalize"
)

// Adapter wraps the existing Setu Client as a SourceConnector.
type Adapter struct {
	client *Client
}

// NewAdapter creates a Setu AA SourceConnector from environment variables.
func NewAdapter() *Adapter {
	return &Adapter{client: NewClientFromEnv()}
}

// Name returns the connector identifier.
func (a *Adapter) Name() string { return "setu_aa" }

// Sync fetches AA data for the last 12 months and returns normalized structs.
func (a *Adapter) Sync(ctx context.Context, req connectors.SyncRequest) (*connectors.SyncResult, error) {
	from := time.Now().AddDate(-1, 0, 0)
	to := time.Now()

	consentID := req.AuthConfig["consentId"]
	if consentID == "" {
		return nil, fmt.Errorf("consentId required in AuthConfig")
	}

	session, err := a.client.CreateSession(consentID, from, to)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	fiData, err := a.client.GetFIData(session.ID)
	if err != nil {
		return nil, fmt.Errorf("get FI data: %w", err)
	}

	result := &connectors.SyncResult{}

	for _, fip := range fiData.FI {
		for _, fiAccount := range fip.Data {
			acc := fiAccount.Account

			// Account summary update
			if acc.Summary != nil {
				s := acc.Summary
				balancePaise := int64(s.CurrentBalance * 100)
				result.AccountUpdate = &connectors.RawAccountUpdate{
					AccountID:           req.AccountID,
					BusinessID:          req.BusinessID,
					SourceType:          "AA",
					MaskedAccountNumber: fiAccount.MaskedAccNumber,
					AccountType:         s.Type,
					IFSCCode:            s.IFSCCode,
					Balance:             &balancePaise,
					BalanceAt:           s.BalanceDateTime,
				}
			}

			// Transactions
			if acc.Transactions == nil {
				continue
			}

			currency := "INR"
			if acc.Summary != nil && acc.Summary.Currency != "" {
				currency = acc.Summary.Currency
			}

			for _, raw := range acc.Transactions.Transaction {
				txn := connectors.RawTransaction{
					ExternalID:           raw.TxnID,
					Type:                 raw.Type,
					Mode:                 raw.Mode,
					Amount:               raw.Amount,
					Currency:             currency,
					TransactionalBalance: raw.TransactionalBalance,
					TransactionTimestamp: raw.TransactionTimestamp,
					ValueDate:            raw.ValueDate,
					Narration:            raw.Narration, // PLAINTEXT — pii seals later
					Reference:            raw.Reference,
					RevenueRole:          "primary", // Bank transactions are primary
				}
				result.Transactions = append(result.Transactions, txn)

				// Extract UPI counterparties
				if raw.Mode == "UPI" {
					vpa := normalize.ExtractVPA(raw.Narration)
					if vpa != "" {
						cpType := "CUSTOMER"
						if raw.Type == "DEBIT" {
							cpType = "SUPPLIER"
						}
						cp := connectors.RawCounterparty{
							Type:           cpType,
							Identifier:     vpa, // PLAINTEXT — pii seals later
							IdentifierType: "VPA",
							SourceType:     "AA",
						}
						result.Counterparties = append(result.Counterparties, cp)
					}
				}
			}
		}
	}

	return result, nil
}
