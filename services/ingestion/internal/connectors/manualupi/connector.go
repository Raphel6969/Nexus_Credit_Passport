package manualupi

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/nexus-credit-passport/ingestion/internal/connectors"
)

type Connector struct{}

func NewConnector() *Connector {
	return &Connector{}
}

func (c *Connector) Name() string { return "manual_upi" }

func (c *Connector) Sync(_ context.Context, req connectors.SyncRequest) (*connectors.SyncResult, error) {
	amountPaise, err := strconv.ParseInt(req.AuthConfig["amountPaise"], 10, 64)
	if err != nil || amountPaise <= 0 {
		return nil, fmt.Errorf("invalid amountPaise")
	}

	paidAt := req.AuthConfig["paidAt"]
	ts := time.Now().UTC()
	if paidAt != "" {
		parsed, parseErr := time.Parse(time.RFC3339, paidAt)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid paidAt: %w", parseErr)
		}
		ts = parsed.UTC()
	}

	upiRef := req.AuthConfig["upiRef"]
	if upiRef == "" {
		upiRef = fmt.Sprintf("upi-%d", ts.UnixNano())
	}

	payerName := req.AuthConfig["payerName"]
	payerHandle := req.AuthConfig["payerHandle"]

	res := &connectors.SyncResult{
		AccountUpdate: &connectors.RawAccountUpdate{
			AccountID:  req.AccountID,
			BusinessID: req.BusinessID,
			SourceType: "UPI",
		},
		Transactions: []connectors.RawTransaction{
			{
				ExternalID:           upiRef,
				Type:                 "CREDIT",
				Mode:                 "UPI",
				Amount:               float64(amountPaise) / 100.0,
				Currency:             "INR",
				TransactionTimestamp: ts.Format(time.RFC3339),
				Reference:            upiRef,
				Narration:            payerName,
				RevenueRole:          "primary",
			},
		},
	}

	if payerHandle != "" || payerName != "" {
		res.Counterparties = append(res.Counterparties, connectors.RawCounterparty{
			Name:           payerName,
			Type:           "CUSTOMER",
			Identifier:     payerHandle,
			IdentifierType: "VPA",
			SourceType:     "UPI",
		})
	}

	return res, nil
}
