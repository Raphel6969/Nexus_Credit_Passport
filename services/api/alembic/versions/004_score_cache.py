"""Add score_snapshots table for caching computed credit scores

Stores one row per scoring event for a business. The `drivers` JSONB column
holds the full SHAP driver breakdown returned by the Rust scoring service.

Design notes:
- Append-only: new scores always INSERT; never UPDATE an existing snapshot.
- Serves as an audit log of every scoring event.
- Future: Phase 6 UI can show score trend over time; Phase 7 can serve cached
  score without hitting Rust on every GET request.
- Trust boundary respected: only the score (derived output) is stored here,
  never raw features or PII.

Revision ID: 004_score_cache
Revises: 003_gstn_accounting_revenue_role
Create Date: 2026-07-13 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '004_score_cache'
down_revision = '003_gstn_accounting_revenue_role'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'score_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False,
                  comment='Primary key'),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False,
                  comment='FK → businesses.id'),
        sa.Column('score', sa.Integer(), nullable=False,
                  comment='Credit score 300–850 (Indian bureau scale)'),
        sa.Column('confidence', sa.String(), nullable=False,
                  comment='LOW | MEDIUM | HIGH — data-richness signal'),
        sa.Column('model_version', sa.String(), nullable=False,
                  comment='Model artifact version string (e.g. linear-v1.0.0)'),
        sa.Column('drivers', postgresql.JSONB(astext_type=sa.Text()), nullable=True,
                  comment='SHAP driver breakdown: [{feature, label, direction, impact, raw_value, human_note}]'),
        sa.Column('computed_at', sa.DateTime(timezone=True), nullable=False,
                  comment='When the Rust scoring service produced this result'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  comment='Row insertion timestamp'),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'],
                                name='fk_score_snapshots_business_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Most recent score per business (primary access pattern)
    op.create_index(
        'ix_score_snapshots_biz_computed',
        'score_snapshots',
        ['business_id', sa.text('computed_at DESC')],
    )


def downgrade() -> None:
    op.drop_index('ix_score_snapshots_biz_computed', table_name='score_snapshots')
    op.drop_table('score_snapshots')
