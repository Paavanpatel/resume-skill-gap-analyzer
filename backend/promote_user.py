#!/usr/bin/env python3
"""
CLI script to promote a user to admin or super_admin.

Usage:
    python promote_user.py <email> <role>

Examples:
    python promote_user.py admin@example.com admin
    python promote_user.py admin@example.com super_admin
    python promote_user.py admin@example.com user        # demote back

Requires DATABASE_URL or the standard POSTGRES_* env vars to be set.
"""

import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session, async_engine
from app.models.user import User

VALID_ROLES = ("user", "admin", "super_admin")


async def promote(email: str, role: str) -> None:
    """Set the role for a user identified by email."""
    from app.db.session import WriteSession

    async with WriteSession() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None:
            print(f"Error: No user found with email '{email}'.")
            sys.exit(1)

        old_role = user.role
        user.role = role
        await session.commit()
        print(f"Success: {email} role changed from '{old_role}' to '{role}'.")


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python promote_user.py <email> <role>")
        print(f"Valid roles: {', '.join(VALID_ROLES)}")
        sys.exit(1)

    email = sys.argv[1]
    role = sys.argv[2]

    if role not in VALID_ROLES:
        print(f"Error: Invalid role '{role}'. Must be one of: {', '.join(VALID_ROLES)}")
        sys.exit(1)

    asyncio.run(promote(email, role))


if __name__ == "__main__":
    main()
