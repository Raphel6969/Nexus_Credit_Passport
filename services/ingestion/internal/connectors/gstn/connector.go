package gstn

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
	http    *http.Client
}

func NewConnector() *Connector {
	return &Connector{
		baseURL: strings.TrimRight(os.Getenv("GSTN_BASE_URL"), "/"),
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Connector) Name() string { return "gstn" }

func (c *Connector) Sync(ctx context.Context, req connectors.SyncRequest) (*connectors.SyncResult, error) {
	gstin := req.AuthConfig["gstin"]
	if gstin == "" {
		return nil, fmt.Errorf("gstin required in AuthConfig")
	}

	// Fetch GSTR-3B
	url3B := fmt.Sprintf("%s/taxpayer/%s/gstr3b?period=062025", c.baseURL, gstin)
	b3b, err := c.doGet(url3B)
	if err != nil {
		return nil, fmt.Errorf("fetch GSTR-3B: %w", err)
	}

	var gstr3b struct {
		Period        string `json:"period"`
		GrossTurnover int64  `json:"gross_turnover"`
		TaxPaid       int64  `json:"tax_paid"`
		FilingDate    string `json:"filing_date"`
		Status        string `json:"status"`
	}
	if err := json.Unmarshal(b3b, &gstr3b); err != nil {
		return nil, fmt.Errorf("parse GSTR-3B: %w", err)
	}

	// Fetch GSTR-1
	url1 := fmt.Sprintf("%s/taxpayer/%s/gstr1?period=062025", c.baseURL, gstin)
	b1, err := c.doGet(url1)
	if err != nil {
		return nil, fmt.Errorf("fetch GSTR-1: %w", err)
	}

	var gstr1 struct {
		Period string `json:"period"`
		B2B    []struct {
			Ctin string `json:"ctin"`
			Name string `json:"name"`
		} `json:"b2b"`
	}
	if err := json.Unmarshal(b1, &gstr1); err != nil {
		return nil, fmt.Errorf("parse GSTR-1: %w", err)
	}

	result := &connectors.SyncResult{}

	tf := connectors.RawTaxFiling{
		ReturnType:    "GSTR3B",
		Period:        gstr3b.Period,
		GrossTurnover: &gstr3b.GrossTurnover,
		TaxPaid:       &gstr3b.TaxPaid,
		FilingDate:    gstr3b.FilingDate,
		Status:        gstr3b.Status,
	}
	result.TaxFilings = append(result.TaxFilings, tf)

	txn := connectors.RawTransaction{
		ExternalID:           fmt.Sprintf("gstn-3b-%s-%s", gstin, gstr3b.Period),
		Type:                 "CREDIT",
		Mode:                 "GST_FILING",
		Amount:               float64(gstr3b.GrossTurnover) / 100.0,
		Currency:             "INR",
		TransactionTimestamp: gstr3b.FilingDate + "T00:00:00Z",
		RevenueRole:          "tax_summary",
	}
	result.Transactions = append(result.Transactions, txn)

	result.RawPayloads = append(result.RawPayloads, connectors.RawPayload{
		TargetTable: "tax_filings",
		TargetID:    gstr3b.Period,
		FieldName:   "raw_data_sealed",
		Plaintext:   b3b,
	})

	for _, b2b := range gstr1.B2B {
		cp := connectors.RawCounterparty{
			Name:           b2b.Name,
			Type:           "CUSTOMER",
			Identifier:     b2b.Ctin,
			IdentifierType: "GSTIN",
			SourceType:     "GSTN",
		}
		result.Counterparties = append(result.Counterparties, cp)
	}

	return result, nil
}

func (c *Connector) doGet(url string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
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
