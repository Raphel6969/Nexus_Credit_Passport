// Package pii provides the single PII-sealing chokepoint for the ingestion pipeline.
//
// ALL connectors return plaintext PII fields. The orchestrator calls pii.SealFields(),
// pii.SealBlob(), and pii.ComputeBlindIndexes() ONCE after Sync() returns, before
// any data hits the database. No connector ever calls age.Encrypt or hmac.New directly.
//
// This ensures:
//   - Same key, same algorithm, regardless of data source.
//   - A GSTIN found in GSTR-1 hashes identically to a GSTIN found in a bank narration.
//   - Raw audit blobs (e.g., tax_filings.raw_data_sealed) use the same sealing path.
package pii

import (
	"fmt"

	"github.com/nexus-credit-passport/ingestion/internal/connectors"
	"github.com/nexus-credit-passport/ingestion/internal/crypto"
)

// Processor holds the crypto tools for the PII sealing chokepoint.
type Processor struct {
	sealer     *crypto.Sealer
	blindIndex *crypto.BlindIndex
}

// NewProcessor creates a Processor from environment-loaded crypto tools.
func NewProcessor() (*Processor, error) {
	sealer, err := crypto.NewSealerFromEnv()
	if err != nil {
		return nil, fmt.Errorf("init sealer: %w", err)
	}
	bi, err := crypto.NewBlindIndexFromEnv()
	if err != nil {
		return nil, fmt.Errorf("init blind index: %w", err)
	}
	return &Processor{sealer: sealer, blindIndex: bi}, nil
}

// SealFields encrypts PII fields in-place on RawTransaction and RawCounterparty slices.
// Fields sealed:
//   - RawTransaction.Narration → age ciphertext (base64)
//   - RawCounterparty.Identifier → age ciphertext (base64)
//   - RawCounterparty.Name → age ciphertext (base64)
func (p *Processor) SealFields(txns []connectors.RawTransaction, cps []connectors.RawCounterparty) error {
	for i := range txns {
		if txns[i].Narration != "" {
			sealed, err := p.sealer.Seal(txns[i].Narration)
			if err != nil {
				return fmt.Errorf("seal txn[%d] narration: %w", i, err)
			}
			txns[i].Narration = sealed
		}
	}
	for i := range cps {
		if cps[i].Identifier != "" {
			sealed, err := p.sealer.Seal(cps[i].Identifier)
			if err != nil {
				return fmt.Errorf("seal cp[%d] identifier: %w", i, err)
			}
			cps[i].Identifier = sealed
		}
		if cps[i].Name != "" {
			sealed, err := p.sealer.Seal(cps[i].Name)
			if err != nil {
				return fmt.Errorf("seal cp[%d] name: %w", i, err)
			}
			cps[i].Name = sealed
		}
	}
	return nil
}

// SealBlob encrypts arbitrary raw payloads in-place (e.g., full GSTN return JSON).
// After this call, each RawPayload.Plaintext is replaced with its age ciphertext.
func (p *Processor) SealBlob(payloads []connectors.RawPayload) error {
	for i := range payloads {
		if len(payloads[i].Plaintext) == 0 {
			continue
		}
		sealed, err := p.sealer.Seal(string(payloads[i].Plaintext))
		if err != nil {
			return fmt.Errorf("seal blob[%d] %s.%s: %w", i, payloads[i].TargetTable, payloads[i].FieldName, err)
		}
		payloads[i].Sealed = sealed
	}
	return nil
}

// ComputeBlindIndexes computes HMAC blind indexes in-place on transactions and counterparties.
// Fields indexed:
//   - RawTransaction.ExternalID → RawTransaction.ExternalIDHMAC
//   - RawCounterparty.Identifier → RawCounterparty.IdentifierHMAC
//     (computed BEFORE SealFields, since we need the plaintext identifier)
func (p *Processor) ComputeBlindIndexes(txns []connectors.RawTransaction, cps []connectors.RawCounterparty) {
	for i := range txns {
		if txns[i].ExternalID != "" {
			txns[i].ExternalIDHMAC = p.blindIndex.Hash(txns[i].ExternalID)
		}
	}
	for i := range cps {
		if cps[i].Identifier != "" {
			cps[i].IdentifierHMAC = p.blindIndex.Hash(cps[i].Identifier)
		}
	}
}

// ProcessAll runs the full PII pipeline: blind indexes (on plaintext) → seal fields → seal blobs.
// This is the single entry point the orchestrator calls.
func (p *Processor) ProcessAll(result *connectors.SyncResult) error {
	// 1. Compute blind indexes FIRST (needs plaintext identifiers)
	p.ComputeBlindIndexes(result.Transactions, result.Counterparties)

	// 2. Seal PII fields (replaces plaintext with ciphertext)
	if err := p.SealFields(result.Transactions, result.Counterparties); err != nil {
		return fmt.Errorf("seal fields: %w", err)
	}

	// 3. Seal raw audit blobs
	if err := p.SealBlob(result.RawPayloads); err != nil {
		return fmt.Errorf("seal blobs: %w", err)
	}

	return nil
}
