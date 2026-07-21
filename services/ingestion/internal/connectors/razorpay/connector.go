package razorpay

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/nexus-credit-passport/ingestion/internal/connectors"
)

type Connector struct {
	baseURL string
	keyID   string
	keySec  string
	http    *http.Client
}

func NewConnector() *Connector {
	return &Connector{
		baseURL: strings.TrimRight(os.Getenv("RAZORPAY_BASE_URL"), "/"),
		keyID:   os.Getenv("RAZORPAY_KEY_ID"),
		keySec:  os.Getenv("RAZORPAY_KEY_SECRET"),
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Connector) Name() string { return "razorpay" }

func (c *Connector) Sync(ctx context.Context, req connectors.SyncRequest) (*connectors.SyncResult, error) {
	result := &connectors.SyncResult{}

	// Fetch Payments
	urlPayments := fmt.Sprintf("%s/v1/payments?count=100", c.baseURL)
	bp, err := c.doGet(urlPayments)
	if err != nil {
		return nil, fmt.Errorf("fetch payments: %w", err)
	}

	var paymentsRes struct {
		Items []struct {
			ID        string `json:"id"`
			Amount    int64  `json:"amount"` // paise
			Currency  string `json:"currency"`
			Status    string `json:"status"`
			Email     string `json:"email"`
			CreatedAt int64  `json:"created_at"`
		} `json:"items"`
	}
	if err := json.Unmarshal(bp, &paymentsRes); err != nil {
		return nil, fmt.Errorf("parse payments: %w", err)
	}

	for _, p := range paymentsRes.Items {
		ts := time.Unix(p.CreatedAt, 0).UTC().Format(time.RFC3339)
		txn := connectors.RawTransaction{
			ExternalID:           p.ID,
			Type:                 "CREDIT",
			Mode:                 "RAZORPAY",
			Amount:               float64(p.Amount) / 100.0,
			Currency:             p.Currency,
			TransactionTimestamp: ts,
			RevenueRole:          "informational",
		}
		result.Transactions = append(result.Transactions, txn)

		if p.Email != "" {
			cp := connectors.RawCounterparty{
				Type:           "CUSTOMER",
				Identifier:     p.Email,
				IdentifierType: "EMAIL",
				SourceType:     "RAZORPAY",
			}
			result.Counterparties = append(result.Counterparties, cp)
		}
	}

	// Fetch Settlements
	urlSettlements := fmt.Sprintf("%s/v1/settlements?count=100", c.baseURL)
	bs, err := c.doGet(urlSettlements)
	if err != nil {
		return nil, fmt.Errorf("fetch settlements: %w", err)
	}

	var setRes struct {
		Items []struct {
			ID        string `json:"id"`
			Amount    int64  `json:"amount"`
			Currency  string `json:"currency"`
			CreatedAt int64  `json:"created_at"`
		} `json:"items"`
	}
	if err := json.Unmarshal(bs, &setRes); err != nil {
		return nil, fmt.Errorf("parse settlements: %w", err)
	}

	for _, s := range setRes.Items {
		ts := time.Unix(s.CreatedAt, 0).UTC().Format(time.RFC3339)
		txn := connectors.RawTransaction{
			ExternalID:           s.ID,
			Type:                 "CREDIT",
			Mode:                 "RAZORPAY_SETTLEMENT",
			Amount:               float64(s.Amount) / 100.0,
			Currency:             s.Currency,
			TransactionTimestamp: ts,
			RevenueRole:          "informational",
		}
		result.Transactions = append(result.Transactions, txn)
	}

	return result, nil
}

func (c *Connector) doGet(url string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.keyID, c.keySec)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}
