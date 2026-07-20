"""add_ai_insights

Revision ID: cdf6cae3c26c
Revises: 005_consent_audit
Create Date: 2026-07-20 16:40:13.623603

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cdf6cae3c26c'
down_revision = '005_consent_audit'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add ai_explanation to score_snapshots
    op.add_column('score_snapshots', sa.Column('ai_explanation', sa.Text(), nullable=True))
    
    # Create dashboard_insights table for caching AI insights
    op.create_table(
        'dashboard_insights',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('business_id', sa.UUID(), nullable=False),
        sa.Column('data_hash', sa.String(length=64), nullable=False),
        sa.Column('insight_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_dashboard_insights_business_id', 'dashboard_insights', ['business_id'])
    op.create_index('ix_dashboard_insights_data_hash', 'dashboard_insights', ['data_hash'])


def downgrade() -> None:
    op.drop_index('ix_dashboard_insights_data_hash', table_name='dashboard_insights')
    op.drop_index('ix_dashboard_insights_business_id', table_name='dashboard_insights')
    op.drop_table('dashboard_insights')
    op.drop_column('score_snapshots', 'ai_explanation')
