"""Add preferences JSONB column to users.

Stores user-level preferences (theme, notifications, AI provider, etc.)
as a JSONB blob so individual preference keys can be added without
future migrations.

Revision ID: 005_user_preferences
Revises: 004_crud_columns
Create Date: 2026-03-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision: str = "005_user_preferences"
down_revision: Union[str, None] = "004_crud_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "preferences",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "preferences")
