package tally

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/nexus-credit-passport/ingestion/internal/connectors"
)

// Connector fetches daybook vouchers from a Tally ERP HTTP XML server.
type Connector struct {
	baseURL string
	http    *http.Client
}

// NewConnector reads TALLY_BASE_URL from the environment.
func NewConnector() *Connector {
	return &Connector{
		baseURL: strings.TrimRight(os.Getenv("TALLY_BASE_URL"), "/"),
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Name returns the connector identifier.
func (c *Connector) Name() string { return "tally" }

// daybookRequest is the XML payload sent to Tally to request the daybook export.
const daybookRequest = `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Daybook</ID></HEADER>
  <BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE>20250401</SVFROMDATE><SVTODATE>20251231</SVTODATE></STATICVARIABLES></DESC></BODY>
</ENVELOPE>`

// envelope is the top-level Tally XML response structure.
type envelope struct {
	XMLName  xml.Name  `xml:"ENVELOPE"`
	Vouchers []voucher `xml:"BODY>DATA>TALLYMESSAGE>VOUCHER"`
}

// voucher represents a single Tally voucher entry.
type voucher struct {
	VchType     string `xml:"VCHTYPE,attr"`
	Date        string `xml:"DATE,attr"`
	Narration   string `xml:"NARRATION,attr"`
	Amount      string `xml:"AMOUNT,attr"`
	PartyLedger string `xml:"PARTYLEDGERNAME,attr"`
}

// Sync posts the daybook export request to Tally, parses the XML response,
// and returns normalized transactions and counterparties.
// The connector never performs any PII sealing — the orchestrator does that.
func (c *Connector) Sync(ctx context.Context, req connectors.SyncRequest) (*connectors.SyncResult, error) {
	rawBytes, err := c.fetchDaybook(ctx)
	if err != nil {
		return nil, fmt.Errorf("tally fetch daybook: %w", err)
	}

	var env envelope
	if err := xml.Unmarshal(rawBytes, &env); err != nil {
		return nil, fmt.Errorf("tally parse XML: %w", err)
	}

	result := &connectors.SyncResult{}

	// Track duplicate ExternalIDs — Tally can emit multiple vouchers with the
	// same type+date combination, so we suffix with an index when needed.
	idCount := make(map[string]int)

	for _, v := range env.Vouchers {
		txnType, revenueRole, ok := classifyVoucher(v.VchType)
		if !ok {
			// Skip unrecognised voucher types.
			continue
		}

		amount, err := parseAmount(v.Amount)
		if err != nil {
			return nil, fmt.Errorf("tally parse amount %q for voucher %s/%s: %w", v.Amount, v.VchType, v.Date, err)
		}

		ts, err := parseDate(v.Date)
		if err != nil {
			return nil, fmt.Errorf("tally parse date %q: %w", v.Date, err)
		}

		// Build a unique ExternalID; suffix with index when duplicates arise.
		baseID := fmt.Sprintf("tally-%s-%s", v.VchType, v.Date)
		idCount[baseID]++
		externalID := baseID
		if idCount[baseID] > 1 {
			externalID = fmt.Sprintf("%s-%d", baseID, idCount[baseID])
		}

		txn := connectors.RawTransaction{
			ExternalID:           externalID,
			Type:                 txnType,
			Mode:                 "TALLY",
			Amount:               amount,
			Currency:             "INR",
			TransactionTimestamp: ts,
			Narration:            v.Narration, // plaintext — orchestrator seals it
			RevenueRole:          revenueRole,
		}
		result.Transactions = append(result.Transactions, txn)

		// Emit a counterparty record when a party ledger name is present.
		if v.PartyLedger != "" {
			cp := connectors.RawCounterparty{
				Name:           v.PartyLedger,
				Type:           "CUSTOMER",
				IdentifierType: "TALLY_LEDGER",
				SourceType:     "TALLY",
			}
			result.Counterparties = append(result.Counterparties, cp)
		}
	}

	// Store the raw XML response as an auditable payload.
	// The orchestrator will age-encrypt the Plaintext field before writing.
	result.RawPayloads = append(result.RawPayloads, connectors.RawPayload{
		TargetTable: "raw_audit",
		FieldName:   "raw_data_sealed",
		Plaintext:   rawBytes,
	})

	return result, nil
}

// fetchDaybook POSTs the daybook XML request to Tally and returns the raw response bytes.
func (c *Connector) fetchDaybook(ctx context.Context) ([]byte, error) {
	reqBody := bytes.NewBufferString(daybookRequest)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/", reqBody)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "text/xml")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// classifyVoucher maps a Tally VCHTYPE to a transaction type, revenue role, and
// an ok flag (false means skip this voucher type).
func classifyVoucher(vchType string) (txnType, revenueRole string, ok bool) {
	switch vchType {
	case "Receipt", "Sales":
		return "CREDIT", "informational", true
	case "Payment", "Purchase":
		return "DEBIT", "informational", true
	default:
		return "", "", false
	}
}

// parseAmount parses a Tally AMOUNT attribute string (which may be negative
// due to Tally's double-entry sign convention) and returns its absolute value
// as float64 rupees.
func parseAmount(raw string) (float64, error) {
	f, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return 0, err
	}
	return math.Abs(f), nil
}

// parseDate converts a Tally YYYYMMDD date string to RFC3339 midnight UTC.
func parseDate(raw string) (string, error) {
	t, err := time.Parse("20060102", strings.TrimSpace(raw))
	if err != nil {
		return "", err
	}
	return t.UTC().Format("2006-01-02T00:00:00Z"), nil
}
