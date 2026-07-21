package setu

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// CreateConsent submits a consent request to the AA and returns the consent ID and redirect URL.
func (c *Client) CreateConsent(from, to time.Time) (*ConsentResponse, error) {
	fiuEntityID := os.Getenv("SETU_FIU_ENTITY_ID")
	now := time.Now().UTC().Format(time.RFC3339)
	txnID := fmt.Sprintf("nexus-%d", time.Now().UnixNano())

	req := ConsentRequest{
		Ver:       "2.1.0",
		Timestamp: now,
		TxnID:     txnID,
		ConsentDetail: ConsentDetail{
			ConsentStart:  now,
			ConsentExpiry: time.Now().Add(365 * 24 * time.Hour).UTC().Format(time.RFC3339),
			ConsentMode:   "STORE",
			FetchType:     "PERIODIC",
			ConsentTypes:  []string{"PROFILE", "SUMMARY", "TRANSACTIONS"},
			FITypes:       []string{"DEPOSIT"},
			DataConsumer: DataConsumer{
				ID:   fiuEntityID,
				Type: "FIU",
			},
			Customer: Customer{
				ID: "customer@setu",
				Identifiers: []Identifier{
					{Type: "MOBILE", Value: "9999999999"},
				},
			},
			Purpose: Purpose{
				Code:     "101",
				RefURI:   "https://api.rebit.org.in/aa/purpose/101.xml",
				Text:     "Credit underwriting for MSME",
				Category: PurposeCategory{Type: "string"},
			},
			FIDataRange: DateRange{
				From: from.UTC().Format(time.RFC3339),
				To:   to.UTC().Format(time.RFC3339),
			},
			DataLife:  TimeUnit{Unit: "MONTH", Value: 6},
			Frequency: TimeUnit{Unit: "HOUR", Value: 4},
		},
	}

	body, status, err := c.doRequest("POST", "/consents", req)
	if err != nil {
		return nil, fmt.Errorf("create consent request: %w", err)
	}
	if status != 201 {
		return nil, fmt.Errorf("create consent: unexpected status %d: %s", status, body)
	}

	var resp ConsentResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("decode consent response: %w", err)
	}
	return &resp, nil
}

// GetConsent retrieves the current status of a consent by its ID.
func (c *Client) GetConsent(consentID string) (*ConsentStatusResponse, error) {
	body, status, err := c.doRequest("GET", "/consents/"+consentID, nil)
	if err != nil {
		return nil, fmt.Errorf("get consent: %w", err)
	}
	if status != 200 {
		return nil, fmt.Errorf("get consent: unexpected status %d: %s", status, body)
	}

	var resp ConsentStatusResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("decode consent status response: %w", err)
	}
	return &resp, nil
}
