package setu

import (
	"encoding/json"
	"fmt"
	"time"
)

// CreateSession creates a data fetch session for an active consent.
// Returns the session ID; callers should poll GetSession or wait for the webhook.
func (c *Client) CreateSession(consentID string, from, to time.Time) (*SessionResponse, error) {
	req := SessionRequest{
		ConsentID: consentID,
		DataRange: DateRange{
			From: from.UTC().Format(time.RFC3339),
			To:   to.UTC().Format(time.RFC3339),
		},
		Format: "json",
	}

	body, status, err := c.doRequest("POST", "/sessions", req)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}
	if status != 201 {
		return nil, fmt.Errorf("create session: unexpected status %d: %s", status, body)
	}

	var resp SessionResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("decode session response: %w", err)
	}
	return &resp, nil
}

// GetFIData retrieves the decrypted FI data for a completed session.
// The session must be in COMPLETED or PARTIAL status; callers should retry if PENDING.
func (c *Client) GetFIData(sessionID string) (*FIDataResponse, error) {
	body, status, err := c.doRequest("GET", "/sessions/"+sessionID, nil)
	if err != nil {
		return nil, fmt.Errorf("get FI data: %w", err)
	}
	if status != 200 {
		return nil, fmt.Errorf("get FI data: unexpected status %d: %s", status, body)
	}

	var resp FIDataResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("decode FI data response: %w", err)
	}
	return &resp, nil
}
