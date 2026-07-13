"""Add Indian market fields

Adds fields required by the Rebit AA v2.0.0 schema and Indian market specifics:
- transactions: mode (UPI/NEFT/etc.), narration (encrypted), value_date,
                transactional_balance, external_id_hmac (blind index for dedup)
- accounts: masked_account_number, account_type, ifsc_code, balance, balance_at
- counterparties: identifier_type (VPA/GSTIN/etc.)
- Composite index on transactions(account_id, timestamp DESC)

Revision ID: 002_add_indian_market_fields
Revises: 001_initial_schema
Create Date: 2026-07-13 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '002_add_indian_market_fields'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── transactions ──────────────────────────────────────────────────────────
    op.add_column('transactions', sa.Column(
        'external_id_hmac', sa.String(), nullable=True,
        comment='HMAC-SHA256(blind_index_key, external_txn_id) — dedup, not PII'
    ))
    op.add_column('transactions', sa.Column(
        'mode', sa.String(), nullable=True,
        comment='Rebit transaction mode: UPI/NEFT/RTGS/IMPS/NACH/ATM/CARD/CHEQUE/ECS/OTHERS'
    ))
    op.add_column('transactions', sa.Column(
        'narration', sa.Text(), nullable=True,
        comment='Raw bank narration — asymmetrically encrypted (age sealed-box, base64)'
    ))
    op.add_column('transactions', sa.Column(
        'value_date', sa.Date(), nullable=True,
        comment='Settlement/value date — may differ from transaction timestamp'
    ))
    op.add_column('transactions', sa.Column(
        'transactional_balance', sa.BigInteger(), nullable=True,
        comment='Running balance after this transaction in minor units (paise)'
    ))

    # Unique constraint on the blind index for dedup
    op.create_index(
        'ix_transactions_external_id_hmac',
        'transactions',
        ['external_id_hmac'],
        unique=True,
        postgresql_where=sa.text('external_id_hmac IS NOT NULL'),
    )
    # Composite index for hottest read path: all txns for an account, sorted by time
    op.create_index(
        'ix_transactions_account_timestamp',
        'transactions',
        ['account_id', sa.text('timestamp DESC')],
    )

    # ── accounts ──────────────────────────────────────────────────────────────
    op.add_column('accounts', sa.Column(
        'masked_account_number', sa.String(), nullable=True,
        comment='e.g. XXXXXXXX6053 — safe to store unencrypted'
    ))
    op.add_column('accounts', sa.Column(
        'account_type', sa.String(), nullable=True,
        comment='SAVINGS / CURRENT / OVERDRAFT / CC — from AA Summary.type'
    ))
    op.add_column('accounts', sa.Column(
        'ifsc_code', sa.String(11), nullable=True,
        comment='Bank IFSC code'
    ))
    op.add_column('accounts', sa.Column(
        'balance', sa.BigInteger(), nullable=True,
        comment='Latest known balance in minor units (paise)'
    ))
    op.add_column('accounts', sa.Column(
        'balance_at', sa.DateTime(timezone=True), nullable=True,
        comment='Timestamp of the balance snapshot from AA Summary.balanceDateTime'
    ))

    # ── counterparties ────────────────────────────────────────────────────────
    op.add_column('counterparties', sa.Column(
        'identifier_type', sa.String(), nullable=True,
        comment='VPA / GSTIN / ACCOUNT_IFSC / PAN / PHONE'
    ))


def downgrade() -> None:
    op.drop_column('counterparties', 'identifier_type')

    op.drop_column('accounts', 'balance_at')
    op.drop_column('accounts', 'balance')
    op.drop_column('accounts', 'ifsc_code')
    op.drop_column('accounts', 'account_type')
    op.drop_column('accounts', 'masked_account_number')

    op.drop_index('ix_transactions_account_timestamp', table_name='transactions')
    op.drop_index('ix_transactions_external_id_hmac', table_name='transactions')
    op.drop_column('transactions', 'transactional_balance')
    op.drop_column('transactions', 'value_date')
    op.drop_column('transactions', 'narration')
    op.drop_column('transactions', 'mode')
    op.drop_column('transactions', 'external_id_hmac')
