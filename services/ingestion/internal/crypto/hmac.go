// Package crypto — HMAC blind index for PII-safe deduplication.
//
// Problem: We need to deduplicate transactions by the FIP's txnId, but txnId
// is PII (or at least sensitive — it can be used to correlate across systems).
// Storing it in plaintext would widen the trust surface.
//
// Solution: Store HMAC-SHA256(hmac_key, txnId) as external_id_hmac. This is:
//   - Deterministic: same input always produces same output → dedup works.
//   - One-way: cannot recover txnId from the HMAC without the key.
//   - Query-safe: Postgres can index and do exact-match lookups on it.
//
// The HMAC key is separate from the age encryption keypair.
package crypto

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
)

// BlindIndex holds the HMAC key used to compute deterministic blind indexes.
type BlindIndex struct {
	key []byte
}

// NewBlindIndexFromEnv loads the HMAC key from the HMAC_BLIND_INDEX_KEY env var.
// The key must be a 64-character hex string (32 bytes).
func NewBlindIndexFromEnv() (*BlindIndex, error) {
	hexKey := strings.TrimSpace(os.Getenv("HMAC_BLIND_INDEX_KEY"))
	if hexKey == "" {
		return nil, fmt.Errorf("HMAC_BLIND_INDEX_KEY env var is not set")
	}
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("HMAC_BLIND_INDEX_KEY must be hex-encoded: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("HMAC_BLIND_INDEX_KEY must be 32 bytes (64 hex chars), got %d bytes", len(key))
	}
	return &BlindIndex{key: key}, nil
}

// Hash computes HMAC-SHA256(key, value) and returns the lowercase hex string.
// Returns empty string for empty input (no blind index for null values).
func (b *BlindIndex) Hash(value string) string {
	if value == "" {
		return ""
	}
	mac := hmac.New(sha256.New, b.key)
	mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

// HashPtr computes HMAC for a string pointer. Returns nil for nil or empty input.
func (b *BlindIndex) HashPtr(value *string) *string {
	if value == nil || *value == "" {
		return nil
	}
	h := b.Hash(*value)
	return &h
}
