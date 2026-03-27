"""Add retry_count to analyses and last_used_at to resumes.

retry_count tracks how many times a failed analysis has been retried
(max 3). last_used_at records when a resume was most recently selected
for an analysis run, enabling the 'Use Existing' picker to sort by
recency.

Revision ID: 004_crud_columns
Revises: 003_gap_analysis
Create Date: 2026-03-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = "004_crud_columns"
down_revision: Union[str, None] = "003_gap_analysis"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "resumes",
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("resumes", "last_used_at")
    op.drop_column("analyses", "retry_count")
