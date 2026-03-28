"""
Billing endpoints — Phase 3 (Stripe integration).

Endpoints:
  GET  /billing/usage           -- Current period usage + quota
  POST /billing/checkout/{tier} -- Create Stripe Checkout Session (upgrade)
  POST /billing/portal          -- Create Stripe Customer Portal Session
  POST /billing/webhook         -- Stripe webhook receiver (no auth)
"""

import logging

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.core.exceptions import ValidationError
from app.db.session import get_db_session, get_read_db_session
from app.services.billing_service import (
    create_checkout_session,
    create_portal_session,
    handle_webhook_event,
)
from app.services.usage_service import get_usage_summary

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_UPGRADE_TIERS = {"pro", "enterprise"}


# ── Usage summary ─────────────────────────────────────────────


@router.get("/usage", summary="Get current usage and quota")
async def get_usage(
    user: CurrentUser,
    session: AsyncSession = Depends(get_read_db_session),
):
    """
    Return the authenticated user's usage for the current billing period.

    Shape:
      {
        "period": "2026-03",
        "tier": "free",
        "analyses": { "used": 3, "limit": 5, "pct": 60 }
      }
    """
    return await get_usage_summary(
        user_id=str(user.id),
        tier=user.tier,
        session=session,
    )


# ── Checkout session ──────────────────────────────────────────


@router.post("/checkout/{tier}", summary="Create Stripe Checkout Session")
async def checkout(
    tier: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Create a Stripe Checkout Session for upgrading to the given tier.

    Returns { "url": "<stripe_checkout_url>" }.
    Redirect the user to this URL from the frontend.
    """
    if tier not in VALID_UPGRADE_TIERS:
        raise ValidationError(
            message=f"Invalid tier '{tier}'. Choose 'pro' or 'enterprise'.",
        )

    url = await create_checkout_session(user=user, tier=tier, session=session)

    if url is None:
        raise ValidationError(
            message="Billing is not configured on this server. "
                    "Set STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID in environment.",
        )

    return {"url": url}


# ── Customer portal ───────────────────────────────────────────


@router.post("/portal", summary="Create Stripe Customer Portal Session")
async def portal(
    user: CurrentUser,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Create a Stripe Customer Portal session so the user can manage
    their subscription (cancel, update payment, etc.).

    Returns { "url": "<stripe_portal_url>" }.
    """
    url = await create_portal_session(user=user, session=session)

    if url is None:
        raise ValidationError(
            message="Billing is not configured or no subscription found.",
        )

    return {"url": url}


# ── Stripe webhook ────────────────────────────────────────────


@router.post(
    "/webhook",
    summary="Stripe webhook receiver",
    include_in_schema=False,  # Don't expose in docs (Stripe calls this directly)
)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Receive and process Stripe webhook events.

    This endpoint is called by Stripe, not the frontend. It verifies the
    webhook signature using STRIPE_WEBHOOK_SECRET before processing.
    """
    payload = await request.body()

    if not stripe_signature:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing Stripe-Signature header."},
        )

    try:
        result = await handle_webhook_event(
            payload=payload,
            sig_header=stripe_signature,
            session=session,
        )
        return {"received": True, **result}
    except ValueError as exc:
        # Invalid signature
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception as exc:
        logger.error("Webhook processing error: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Webhook processing failed."},
        )
