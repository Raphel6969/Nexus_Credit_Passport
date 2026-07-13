"""Add GSTN, accounting tables, revenue_role tagging, counterparty cross-source columns

Adds:
- transactions.revenue_role: prevents double-counting across AA/Razorpay/GSTN.
  Only 'primary' (bank credits via AA) counts toward cash-flow aggregates.
  Full reconciliation deferred to Phase 4.
- tax_filings: GSTR-3B/GSTR-1 summary data from GSTN connector.
  raw_data_sealed is age-encrypted via shared pii.SealBlob() utility.
- invoices: AR/AP from Zoho Books connector.
- counterparties.source_type: tracks which connector discovered this counterparty.
- counterparties.identifier_hmac: blind index for cross-source counterparty resolution.
  First blind-index column on counterparties (verified: 001 and 002 never shipped one).

Revision ID: 003_gstn_accounting_revenue_role
Revises: 002_add_indian_market_fields
Create Date: 2026-07-13 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '003_gstn_accounting_revenue_role'
down_revision = '002_add_indian_market_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── revenue_role on transactions ─────────────────────────────────────────
    # Prevents double-counting across sources. Default 'primary' for existing AA data.
    # Phase 4 reconciliation logic will use this to deduplicate overlapping revenue signals.
    op.add_column('transactions', sa.Column(
        'revenue_role', sa.String(), nullable=False, server_default='primary',
        comment="primary = counts toward cash flow; informational = reconciliation-only; tax_summary = GST aggregate"
    ))

    # ── tax_filings ──────────────────────────────────────────────────────────
    op.create_table(
        'tax_filings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('return_type', sa.String(), nullable=False,
                  comment='GSTR3B / GSTR1 / GSTR2A'),
        sa.Column('period', sa.String(), nullable=False,
                  comment='YYYY-MM format e.g. 2025-06'),
        sa.Column('gross_turnover', sa.BigInteger(), nullable=True,
                  comment='Turnover in paise'),
        sa.Column('tax_paid', sa.BigInteger(), nullable=True,
                  comment='Tax paid in paise'),
        sa.Column('filing_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(), nullable=False,
                  comment='FILED / PENDING / LATE'),
        sa.Column('raw_data_sealed', sa.Text(), nullable=True,
                  comment='age-encrypted full return JSON via pii.SealBlob()'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_tax_filings_biz_type_period',
        'tax_filings',
        ['business_id', 'return_type', 'period'],
        unique=True,
    )

    # ── invoices (AR/AP from Zoho Books) ─────────────────────────────────────
    op.create_table(
        'invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('counterparty_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('external_id_hmac', sa.String(), nullable=True,
                  comment='Blind index of Zoho invoice ID via pii.BlindIndex()'),
        sa.Column('invoice_type', sa.String(), nullable=False,
                  comment='RECEIVABLE / PAYABLE'),
        sa.Column('amount', sa.BigInteger(), nullable=False,
                  comment='Amount in paise'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='INR'),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('paid_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(), nullable=False,
                  comment='DRAFT / SENT / OVERDUE / PAID / VOID'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.ForeignKeyConstraint(['counterparty_id'], ['counterparties.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_invoices_external_id_hmac',
        'invoices',
        ['external_id_hmac'],
        unique=True,
        postgresql_where=sa.text('external_id_hmac IS NOT NULL'),
    )
    op.create_index(
        'ix_invoices_biz_status',
        'invoices',
        ['business_id', 'status'],
    )

    # ── counterparty cross-source resolution ─────────────────────────────────
    op.add_column('counterparties', sa.Column(
        'source_type', sa.String(), nullable=True,
        comment='Which connector discovered this counterparty: AA / GSTN / RAZORPAY / ZOHO'
    ))
    op.add_column('counterparties', sa.Column(
        'identifier_hmac', sa.String(), nullable=True,
        comment='HMAC blind index of identifier for cross-source counterparty matching'
    ))
    op.create_index(
        'ix_counterparties_biz_idtype_hmac',
        'counterparties',
        ['business_id', 'identifier_type', 'identifier_hmac'],
        unique=True,
        postgresql_where=sa.text('identifier_hmac IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('ix_counterparties_biz_idtype_hmac', table_name='counterparties')
    op.drop_column('counterparties', 'identifier_hmac')
    op.drop_column('counterparties', 'source_type')

    op.drop_index('ix_invoices_biz_status', table_name='invoices')
    op.drop_index('ix_invoices_external_id_hmac', table_name='invoices')
    op.drop_table('invoices')

    op.drop_index('ix_tax_filings_biz_type_period', table_name='tax_filings')
    op.drop_table('tax_filings')

    op.drop_column('transactions', 'revenue_role')
