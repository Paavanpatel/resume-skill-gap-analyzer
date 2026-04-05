"""
Stripe billing integration.

Provides helpers for:
- Creating / retrieving a Stripe Customer for a user
- Creating a Checkout Session (subscription)
- Creating a Customer Portal Session (manage/cancel)
- Handling webhook events (subscription updated/deleted)

All Stripe calls are wrapped in try/except so a Stripe outage
never raises an unhandled 500 — callers decide how to surface
the error to the user.
"""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.user import User
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)


def _get_stripe():
    """
    Lazily import and configure the Stripe SDK.
    Returns the stripe module or None if not installed / not configured.
    """
    settings = get_settings()
    if not settings.stripe_secret_key:
        return None
    try:
        import stripe

        stripe.api_key = settings.stripe_secret_key
        return stripe
    except ImportError:
        logger.warning("stripe package not installed. Billing features disabled.")
        return None


# ── Stripe tier → price ID mapping ───────────────────────────


def _price_id_for_tier(tier: str) -> Optional[str]:
    settings = get_settings()
    return {
        "pro": settings.stripe_pro_price_id or None,
        "enterprise": settings.stripe_enterprise_price_id or None,
    }.get(tier)


# ── Stripe tier from subscription status ─────────────────────


def _tier_from_price(price_id: str) -> str:
    settings = get_settings()
    if price_id == settings.stripe_pro_price_id:
        return "pro"
    if price_id == settings.stripe_enterprise_price_id:
        return "enterprise"
    return "free"


# ── Customer management ───────────────────────────────────────


async def get_or_create_customer(
    user: User,
    session: AsyncSession,
) -> Optional[str]:
    """
    Return the Stripe customer ID for this user, creating one if needed.
    Updates user.stripe_customer_id in the DB if a new customer is created.
    Returns None if Stripe is not configured.
    """
    stripe = _get_stripe()
    if stripe is None:
        return None

    if user.stripe_customer_id:
        return user.stripe_customer_id

    try:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name or "",
            metadata={"user_id": str(user.id)},
        )
        repo = UserRepository(session)
        await repo.update(user.id, stripe_customer_id=customer["id"])
        await session.flush()
        return customer["id"]
    except Exception as exc:
        logger.error("Failed to create Stripe customer for %s: %s", user.id, exc)
        return None


# ── Checkout session ──────────────────────────────────────────


async def create_checkout_session(
    user: User,
    tier: str,
    session: AsyncSession,
) -> Optional[str]:
    """
    Create a Stripe Checkout Session for upgrading to `tier`.
    Returns the checkout URL or None on error.
    """
    stripe = _get_stripe()
    if stripe is None:
        return None

    settings = get_settings()
    price_id = _price_id_for_tier(tier)
    if not price_id:
        logger.warning("No Stripe price ID configured for tier '%s'", tier)
        return None

    customer_id = await get_or_create_customer(user, session)
    if not customer_id:
        return None

    try:
        checkout = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.frontend_url}/settings?tab=billing&upgraded=1",
            cancel_url=f"{settings.frontend_url}/pricing",
            metadata={"user_id": str(user.id), "tier": tier},
        )
        return checkout["url"]
    except Exception as exc:
        logger.error("Failed to create checkout session for %s: %s", user.id, exc)
        return None


# ── Customer portal ───────────────────────────────────────────


async def create_portal_session(
    user: User,
    session: AsyncSession,
) -> Optional[str]:
    """
    Create a Stripe Customer Portal session so the user can manage
    their subscription (cancel, update payment method, etc.).
    Returns the portal URL or None on error.
    """
    stripe = _get_stripe()
    if stripe is None:
        return None

    settings = get_settings()
    customer_id = await get_or_create_customer(user, session)
    if not customer_id:
        return None

    try:
        portal = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{settings.frontend_url}/settings?tab=billing",
        )
        return portal["url"]
    except Exception as exc:
        logger.error("Failed to create portal session for %s: %s", user.id, exc)
        return None


# ── Webhook handler ───────────────────────────────────────────


async def handle_webhook_event(
    payload: bytes,
    sig_header: str,
    session: AsyncSession,
) -> dict:
    """
    Verify and handle a Stripe webhook event.

    Handles:
      customer.subscription.updated  → update user.tier
      customer.subscription.deleted  → downgrade user to 'free'

    Returns a dict with { "handled": bool, "event_type": str }.
    """
    stripe = _get_stripe()
    if stripe is None:
        return {"handled": False, "event_type": "stripe_disabled"}

    settings = get_settings()
    if not settings.stripe_webhook_secret:
        return {"handled": False, "event_type": "no_webhook_secret"}

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        raise ValueError("Invalid Stripe webhook signature.")

    event_type = event["type"]
    handled = False

    if event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]

        # Look up the user by stripe_customer_id
        from sqlalchemy import select
        from app.models.user import User as UserModel

        result = await session.execute(
            select(UserModel).where(UserModel.stripe_customer_id == customer_id)
        )
        db_user = result.scalar_one_or_none()

        if db_user:
            if event_type == "customer.subscription.deleted":
                new_tier = "free"
            else:
                # Derive tier from the first item's price
                items = subscription.get("items", {}).get("data", [])
                price_id = items[0]["price"]["id"] if items else ""
                new_tier = _tier_from_price(price_id)

            repo = UserRepository(session)
            await repo.update(db_user.id, tier=new_tier)
            await session.commit()
            handled = True
            logger.info(
                "Updated user %s tier to '%s' from Stripe event %s",
                db_user.id,
                new_tier,
                event_type,
            )

    return {"handled": handled, "event_type": event_type}
