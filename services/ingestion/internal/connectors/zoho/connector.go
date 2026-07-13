package zoho

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
	clientID string
	clientSec string
	orgID   string
	http    *http.Client
}

func NewConnector() *Connector {
	return &Connector{
		baseURL: strings.TrimRight(os.Getenv("ZOHO_BASE_URL"), "/"),
		clientID: os.Getenv("ZOHO_CLIENT_ID"),
		clientSec: os.Getenv("ZOHO_CLIENT_SECRET"),
		orgID:   os.Getenv("ZOHO_ORG_ID"),
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Connector) Name() string { return "zoho" }

func (c *Connector) Sync(ctx context.Context, req connectors.SyncRequest) (*connectors.SyncResult, error) {
	result := &connectors.SyncResult{}

	// Fetch Invoices (receivables)
	urlInv := fmt.Sprintf("%s/api/v3/invoices?organization_id=%s&page=1&per_page=200", c.baseURL, c.orgID)
	binv, err := c.doGet(urlInv)
	if err != nil {
		return nil, fmt.Errorf("fetch invoices: %w", err)
	}

	var invRes struct {
		Invoices []struct {
			InvoiceID   string  `json:"invoice_id"`
			CustomerName string  `json:"customer_name"`
			Total       float64 `json:"total"`
			Currency    string  `json:"currency_code"`
			Date        string  `json:"date"`
			DueDate     string  `json:"due_date"`
			Status      string  `json:"status"` // draft, sent, overdue, paid, void
		} `json:"invoices"`
	}
	if err := json.Unmarshal(binv, &invRes); err != nil {
		return nil, fmt.Errorf("parse invoices: %w", err)
	}

	for _, inv := range invRes.Invoices {
		ri := connectors.RawInvoice{
			ExternalID:  inv.InvoiceID,
			InvoiceType: "RECEIVABLE",
			Amount:      inv.Total,
			Currency:    inv.Currency,
			IssueDate:   inv.Date,
			DueDate:     inv.DueDate,
			Status:      strings.ToUpper(inv.Status),
		}
		if ri.Status == "PAID" {
			// mock paid date as due date for now
			ri.PaidDate = inv.DueDate 
		}
		result.Invoices = append(result.Invoices, ri)

		cp := connectors.RawCounterparty{
			Name:           inv.CustomerName,
			Type:           "CUSTOMER",
			Identifier:     inv.CustomerName, // fallback to name if email missing
			IdentifierType: "NAME",
			SourceType:     "ZOHO",
		}
		result.Counterparties = append(result.Counterparties, cp)
	}

	// Fetch Bills (payables)
	urlBills := fmt.Sprintf("%s/api/v3/bills?organization_id=%s&page=1&per_page=200", c.baseURL, c.orgID)
	bb, err := c.doGet(urlBills)
	if err != nil {
		return nil, fmt.Errorf("fetch bills: %w", err)
	}

	var billRes struct {
		Bills []struct {
			BillID      string  `json:"bill_id"`
			VendorName  string  `json:"vendor_name"`
			Total       float64 `json:"total"`
			Currency    string  `json:"currency_code"`
			Date        string  `json:"date"`
			DueDate     string  `json:"due_date"`
			Status      string  `json:"status"` // draft, open, overdue, paid, void
		} `json:"bills"`
	}
	if err := json.Unmarshal(bb, &billRes); err != nil {
		return nil, fmt.Errorf("parse bills: %w", err)
	}

	for _, bill := range billRes.Bills {
		ri := connectors.RawInvoice{
			ExternalID:  bill.BillID,
			InvoiceType: "PAYABLE",
			Amount:      bill.Total,
			Currency:    bill.Currency,
			IssueDate:   bill.Date,
			DueDate:     bill.DueDate,
			Status:      strings.ToUpper(bill.Status),
		}
		if ri.Status == "PAID" {
			ri.PaidDate = bill.DueDate 
		}
		result.Invoices = append(result.Invoices, ri)

		cp := connectors.RawCounterparty{
			Name:           bill.VendorName,
			Type:           "SUPPLIER",
			Identifier:     bill.VendorName,
			IdentifierType: "NAME",
			SourceType:     "ZOHO",
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
	// For real Zoho this would use OAuth2 bearer token
	req.Header.Set("Authorization", "Zoho-oauthtoken mock_token")
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
