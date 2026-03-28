"""Add role column to users table for RBAC.

Supports three roles: user (default), admin, super_admin.
Used by the admin dashboard and require_role() dependency.

Revision ID: 007_add_user_role
Revises: 006_add_billing
Create Date: 2026-03-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = "007_add_user_role"
down_revision: Union[str, None] = "006_add_billing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(20),
            nullable=False,
            server_default="user",
        ),
    )
    op.create_index("ix_users_role", "users", ["role"])


def downgrade() -> None:
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "role")
