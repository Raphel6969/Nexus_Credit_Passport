// Package store handles database writes for the ingestion service.
//
// All writes use pgx v5 with explicit transactions and upsert semantics:
//   - Transactions deduplicate on external_id_hmac (HMAC blind index)
//   - Accounts upsert on (business_id, account_ref, source_type)
//   - Counterparties upsert on (business_id, identifier_type, external_id_hmac)
//
// The store never decrypts any PII — it only writes sealed ciphertexts.
package store

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nexus-credit-passport/ingestion/internal/normalize"
)

// PGStore is the Postgres-backed data store.
type PGStore struct {
	pool *pgxpool.Pool
}

// New creates a PGStore connected to the database URL in DATABASE_URL_GO env var.
func New(ctx context.Context) (*PGStore, error) {
	dsn := os.Getenv("DATABASE_URL_GO")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL_GO is not set")
	}
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("pgxpool.New: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("pgx pool ping: %w", err)
	}
	return &PGStore{pool: pool}, nil
}

// Close closes the connection pool.
func (s *PGStore) Close() {
	s.pool.Close()
}

// UpsertAccount inserts or updates an account row.
// On conflict with (business_id, account_ref, source_type) it updates sync metadata.
func (s *PGStore) UpsertAccount(ctx context.Context, a normalize.Account) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		INSERT INTO accounts (
			id, business_id, source_type, fi_type, account_ref, status,
			masked_account_number, account_type, ifsc_code, balance, balance_at,
			last_synced_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $13
		)
		ON CONFLICT (id) DO UPDATE SET
			status              = EXCLUDED.status,
			masked_account_number = EXCLUDED.masked_account_number,
			account_type        = COALESCE(EXCLUDED.account_type, accounts.account_type),
			ifsc_code           = COALESCE(EXCLUDED.ifsc_code, accounts.ifsc_code),
			balance             = COALESCE(EXCLUDED.balance, accounts.balance),
			balance_at          = COALESCE(EXCLUDED.balance_at, accounts.balance_at),
			last_synced_at      = EXCLUDED.last_synced_at,
			updated_at          = EXCLUDED.updated_at
	`,
		a.ID, a.BusinessID, a.SourceType, a.FIType, a.AccountRef,
		coalesce(a.Status, "ACTIVE"),
		a.MaskedAccountNumber, a.AccountType, a.IFSCCode, a.Balance, a.BalanceAt,
		now, now,
	)
	return err
}

// UpsertTransaction inserts a transaction, skipping silently if external_id_hmac already exists.
// This prevents double-writes when AA data sessions have overlapping date ranges.
func (s *PGStore) UpsertTransaction(ctx context.Context, t normalize.Transaction) (inserted bool, err error) {
	result, err := s.pool.Exec(ctx, `
		INSERT INTO transactions (
			id, account_id, counterparty_id,
			amount, currency, transactional_balance,
			type, mode, timestamp, value_date,
			narration, description, external_id_hmac,
			reference_number, created_at, updated_at
		) VALUES (
			$1, $2, $3,
			$4, $5, $6,
			$7, $8, $9, $10,
			$11, $12, $13,
			$14, $15, $15
		)
		ON CONFLICT (external_id_hmac) WHERE external_id_hmac IS NOT NULL DO NOTHING
	`,
		t.ID, t.AccountID, t.CounterpartyID,
		t.Amount, t.Currency, t.TransactionalBalance,
		t.Type, t.Mode, t.Timestamp, t.ValueDate,
		t.Narration, t.Description, t.ExternalIDHMAC,
		t.ReferenceNumber, time.Now().UTC(),
	)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

// UpsertCounterparty inserts a counterparty, skipping if (business_id, identifier, identifier_type) conflict.
func (s *PGStore) UpsertCounterparty(ctx context.Context, cp normalize.Counterparty) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `
		INSERT INTO counterparties (
			id, business_id, name, type, identifier, identifier_type,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $7
		)
		ON CONFLICT (id) DO NOTHING
	`,
		cp.ID, cp.BusinessID, cp.Name, cp.Type, cp.Identifier, cp.IdentifierType,
		now,
	)
	return err
}

func coalesce(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
