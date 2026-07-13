// Package setu implements a Go client for the Setu Account Aggregator (AA) FIU API.
//
// API reference: https://docs.setu.co/data/account-aggregator
// All requests authenticate via three headers: x-client-id, x-client-secret,
// x-product-instance-id — loaded from environment variables.
//
// Base URL is controlled by SETU_BASE_URL env var:
//   - Local development: http://localhost:9090 (mock server)
//   - Sandbox:           https://fiu-sandbox.setu.co
//   - Production:        (TBD — same code path, just different URL)
package setu

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// Client is the Setu AA FIU API client.
// All credentials are loaded from environment variables on construction.
type Client struct {
	baseURL           string
	clientID          string
	clientSecret      string
	productInstanceID string
	http              *http.Client
}

// NewClientFromEnv creates a Setu client from environment variables:
//   SETU_BASE_URL, SETU_CLIENT_ID, SETU_CLIENT_SECRET, SETU_PRODUCT_INSTANCE_ID
func NewClientFromEnv() *Client {
	return &Client{
		baseURL:           strings.TrimRight(os.Getenv("SETU_BASE_URL"), "/"),
		clientID:          os.Getenv("SETU_CLIENT_ID"),
		clientSecret:      os.Getenv("SETU_CLIENT_SECRET"),
		productInstanceID: os.Getenv("SETU_PRODUCT_INSTANCE_ID"),
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// doRequest executes an HTTP request with Setu's required authentication headers.
func (c *Client) doRequest(method, path string, body any) ([]byte, int, error) {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, 0, fmt.Errorf("marshal body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, c.baseURL+path, bodyReader)
	if err != nil {
		return nil, 0, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-client-id", c.clientID)
	req.Header.Set("x-client-secret", c.clientSecret)
	req.Header.Set("x-product-instance-id", c.productInstanceID)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("read response body: %w", err)
	}

	return respBody, resp.StatusCode, nil
}
