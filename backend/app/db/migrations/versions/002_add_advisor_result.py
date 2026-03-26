"""Add advisor_result column to analyses table.

Revision ID: 002_advisor_result
Revises: 001_initial
Create Date: 2026-03-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "002_advisor_result"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add advisor_result JSONB column to analyses table
    op.add_column(
        "analyses",
        sa.Column(
            "advisor_result",
            postgresql.JSONB(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    # Remove advisor_result column
    op.drop_column("analyses", "advisor_result")
