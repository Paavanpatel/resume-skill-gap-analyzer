"""Add Phase 6 gap analysis columns to analyses table.

category_breakdowns, score_explanation, and ats_check were added
to the Analysis model in Phase 6 but never got a migration.

Revision ID: 003_gap_analysis
Revises: 002_advisor_result
Create Date: 2026-03-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "003_gap_analysis"
down_revision: Union[str, None] = "002_advisor_result"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column("category_breakdowns", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "analyses",
        sa.Column("score_explanation", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "analyses",
        sa.Column("ats_check", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analyses", "ats_check")
    op.drop_column("analyses", "score_explanation")
    op.drop_column("analyses", "category_breakdowns")
