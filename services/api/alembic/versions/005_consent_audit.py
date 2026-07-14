"""Add consent_audit_log table + extend consent_tokens for Phase 5

Changes:
  consent_tokens:
    + snapshot_data JSONB  — score baked in at mint time (SNAPSHOT scope only)
    + used_at TIMESTAMPTZ  — set when a SNAPSHOT token is consumed (one-time use)

  consent_audit_log (new table):
    Append-only audit trail of every consent lifecycle event.
    Actions: MINTED | RESOLVED | REVOKED | EXPIRED
    Includes requester_ip for RESOLVED events (privacy note: stored as-is,
    mask/hash before this if PII rules require it in prod).

Revision ID: 005_consent_audit
Revises: 004_score_cache
Create Date: 2026-07-13 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '005_consent_audit'
down_revision = '004_score_cache'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend consent_tokens ────────────────────────────────────────────────

    # Baked-in score payload for SNAPSHOT tokens — populated at mint time so
    # lenders see the score as it was when shared, not the current score.
    op.add_column('consent_tokens', sa.Column(
        'snapshot_data',
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
        comment='Score payload captured at mint time (SNAPSHOT scope only)',
    ))

    # Set when a SNAPSHOT token is first (and only) resolved.
    op.add_column('consent_tokens', sa.Column(
        'used_at',
        sa.DateTime(timezone=True),
        nullable=True,
        comment='Timestamp of first (and only) resolution for SNAPSHOT tokens',
    ))

    # ── consent_audit_log ───────────────────────────────────────────────────
    op.create_table(
        'consent_audit_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  comment='Primary key'),
        sa.Column('token_id', postgresql.UUID(as_uuid=True), nullable=False,
                  comment='FK → consent_tokens.id'),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False,
                  comment='FK → businesses.id (denormalised for fast audit queries)'),
        sa.Column('action', sa.String(), nullable=False,
                  comment='MINTED | RESOLVED | REVOKED | EXPIRED'),
        sa.Column('actor', sa.Text(), nullable=True,
                  comment='Who performed the action: business UUID or "resolver" or "system"'),
        sa.Column('resolved_scope', sa.String(), nullable=True,
                  comment='Scope that was revealed on RESOLVED events'),
        sa.Column('requester_ip', sa.Text(), nullable=True,
                  comment='IP address of the token resolver (RESOLVED events only)'),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True,
                  comment='Extra context: user-agent, request headers, etc.'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['token_id'], ['consent_tokens.id'],
                                name='fk_audit_log_token_id'),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'],
                                name='fk_audit_log_business_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Most common query: all events for a token (chronological)
    op.create_index(
        'ix_consent_audit_token_created',
        'consent_audit_log',
        ['token_id', sa.text('created_at DESC')],
    )
    # Dashboard query: all consent actions for a business
    op.create_index(
        'ix_consent_audit_biz_action',
        'consent_audit_log',
        ['business_id', 'action'],
    )


def downgrade() -> None:
    op.drop_index('ix_consent_audit_biz_action', table_name='consent_audit_log')
    op.drop_index('ix_consent_audit_token_created', table_name='consent_audit_log')
    op.drop_table('consent_audit_log')
    op.drop_column('consent_tokens', 'used_at')
    op.drop_column('consent_tokens', 'snapshot_data')
