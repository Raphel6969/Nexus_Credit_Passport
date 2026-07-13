// Package crypto provides asymmetric PII sealing using filippo.io/age.
//
// Architecture:
//   - Ingestion (Go) holds the PUBLIC key and can only Seal (encrypt) plaintext.
//   - Scoring (Rust) holds the PRIVATE key and is the only service that can Unseal.
//   - The API (Python) has no key and cannot read raw PII.
//
// Sealed values are stored as base64-encoded age ciphertexts.
package crypto

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"os"
	"strings"

	"filippo.io/age"
)

// Sealer holds a parsed age recipient (public key) for encrypting PII fields.
type Sealer struct {
	recipient age.Recipient
}

// NewSealerFromEnv loads the age public key from the AGE_PUBLIC_KEY environment variable.
func NewSealerFromEnv() (*Sealer, error) {
	pubKey := strings.TrimSpace(os.Getenv("AGE_PUBLIC_KEY"))
	if pubKey == "" {
		return nil, fmt.Errorf("AGE_PUBLIC_KEY env var is not set")
	}
	recipients, err := age.ParseRecipients(strings.NewReader(pubKey))
	if err != nil || len(recipients) == 0 {
		return nil, fmt.Errorf("failed to parse AGE_PUBLIC_KEY: %w", err)
	}
	return &Sealer{recipient: recipients[0]}, nil
}

// Seal encrypts plaintext with the age recipient public key.
// Returns a base64-encoded ciphertext suitable for storage in TEXT columns.
// Returns an empty string if plaintext is empty.
func (s *Sealer) Seal(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	var buf bytes.Buffer
	w, err := age.Encrypt(&buf, s.recipient)
	if err != nil {
		return "", fmt.Errorf("age.Encrypt: %w", err)
	}
	if _, err := w.Write([]byte(plaintext)); err != nil {
		return "", fmt.Errorf("writing plaintext: %w", err)
	}
	if err := w.Close(); err != nil {
		return "", fmt.Errorf("closing age writer: %w", err)
	}
	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

// SealOptional seals a string pointer. Returns nil if input is nil or empty.
func (s *Sealer) SealOptional(plaintext *string) (*string, error) {
	if plaintext == nil || *plaintext == "" {
		return nil, nil
	}
	sealed, err := s.Seal(*plaintext)
	if err != nil {
		return nil, err
	}
	return &sealed, nil
}
