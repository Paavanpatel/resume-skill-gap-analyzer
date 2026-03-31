#!/usr/bin/env python3
"""
Create a fully-privileged test account with enterprise tier and super_admin role.

The account bypasses all paywalls, quota limits, and feature gates:
  - tier = "enterprise"  → 9999 analyses/month (effectively unlimited)
  - role = "super_admin" → passes every require_role() and require_tier() check
  - is_verified = True   → no email OTP step required

Usage:
    python create_test_user.py
    python create_test_user.py test@example.com TestPass123!
    python create_test_user.py --help

Defaults:
    email    = test@example.local
    password = TestPass123!

Requires POSTGRES_* env vars (or DATABASE_URL) to be set, same as the app.
"""

import asyncio
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import WriteSession
from app.models.user import User

DEFAULT_EMAIL = "test@example.local"
DEFAULT_PASSWORD = "TestPass123!"
DEFAULT_NAME = "Test Account"


async def create_or_update(email: str, password: str) -> None:
    async with WriteSession() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                email=email,
                hashed_password=hash_password(password),
                full_name=DEFAULT_NAME,
                is_active=True,
                is_verified=True,
                tier="enterprise",
                role="super_admin",
            )
            session.add(user)
            await session.commit()
            print(f"Created:  {email}  (tier=enterprise, role=super_admin)")
        else:
            user.hashed_password = hash_password(password)
            user.is_active = True
            user.is_verified = True
            user.tier = "enterprise"
            user.role = "super_admin"
            await session.commit()
            print(f"Updated:  {email}  (tier=enterprise, role=super_admin)")

    print(f"Password: {password}")
    print("Ready — log in and all features are unlocked.")


def main() -> None:
    if "--help" in sys.argv or "-h" in sys.argv:
        print(__doc__)
        sys.exit(0)

    args = sys.argv[1:]
    email = args[0] if len(args) >= 1 else DEFAULT_EMAIL
    password = args[1] if len(args) >= 2 else DEFAULT_PASSWORD

    asyncio.run(create_or_update(email, password))


if __name__ == "__main__":
    main()
