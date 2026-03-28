"""
WebSocket endpoint for real-time analysis progress updates.

Replaces the polling-based status endpoint with push-based updates via
WebSocket + Redis Pub/Sub. The frontend connects here after submitting
an analysis and receives progress messages as the Celery worker processes
each pipeline stage.

Auth: JWT access token passed as a query parameter (?token=xxx).
      WebSocket doesn't support Authorization headers in browsers, so
      query param is the standard approach.

Protocol:
  - Server sends JSON messages: {status, progress, current_step, error_message}
  - Client sends nothing (read-only stream)
  - Server closes on terminal state (completed/failed) or 5-minute timeout
"""

import asyncio
import json
import logging
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import decode_token
from app.db.session import ReadSession
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)

router = APIRouter()

WS_TIMEOUT_SECONDS = 300  # 5-minute timeout


def _pubsub_channel(analysis_id: str) -> str:
    """Redis Pub/Sub channel name for an analysis."""
    return f"analysis:{analysis_id}:progress"


async def _authenticate_ws(token: str) -> UUID | None:
    """
    Validate a JWT token from a WebSocket query param.

    Returns the user_id if valid, None otherwise.
    """
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        return UUID(payload["sub"])
    except Exception:
        return None


async def _verify_ownership(user_id: UUID, analysis_id: UUID) -> bool:
    """Check that the analysis belongs to the user."""
    async with ReadSession() as session:
        repo = AnalysisRepository(session)
        analysis = await repo.get_by_id(analysis_id)
        if analysis is None or str(analysis.user_id) != str(user_id):
            return False
        return True


async def _get_current_status(analysis_id: UUID) -> dict | None:
    """Fetch the current analysis status from the DB."""
    status_map = {
        "queued": (0, "Waiting in queue"),
        "processing": (50, "Processing analysis"),
        "completed": (100, "Analysis complete"),
        "failed": (0, "Analysis failed"),
    }

    async with ReadSession() as session:
        repo = AnalysisRepository(session)
        analysis = await repo.get_by_id(analysis_id)
        if analysis is None:
            return None

        progress, step = status_map.get(analysis.status, (0, "Unknown"))
        return {
            "status": analysis.status,
            "progress": progress,
            "current_step": step,
            "error_message": analysis.error_message if analysis.status == "failed" else None,
        }


@router.websocket("/ws/analysis/{analysis_id}")
async def analysis_websocket(websocket: WebSocket, analysis_id: str):
    """
    WebSocket endpoint for real-time analysis progress.

    Query params:
        token: JWT access token

    Messages sent (JSON):
        {status, progress, current_step, error_message}

    Closes on:
        - Terminal state (completed/failed)
        - 5-minute timeout
        - Client disconnect
        - Auth failure
    """
    # Extract token from query params
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    # Validate JWT
    user_id = await _authenticate_ws(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    # Validate analysis ID
    try:
        aid = UUID(analysis_id)
    except ValueError:
        await websocket.close(code=4002, reason="Invalid analysis ID")
        return

    # Verify ownership
    if not await _verify_ownership(user_id, aid):
        await websocket.close(code=4003, reason="Analysis not found")
        return

    # Accept the connection
    await websocket.accept()

    # Send current status immediately
    current = await _get_current_status(aid)
    if current:
        await websocket.send_json(current)
        if current["status"] in ("completed", "failed"):
            await websocket.close(code=1000)
            return

    # Subscribe to Redis Pub/Sub for live updates
    settings = get_settings()
    channel_name = _pubsub_channel(analysis_id)

    try:
        redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2.0,
        )
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(channel_name)
    except Exception as e:
        logger.warning("Redis Pub/Sub connection failed for WS %s: %s", analysis_id, str(e)[:200])
        # Fallback: tell client to use polling
        await websocket.send_json({
            "status": "error",
            "progress": 0,
            "current_step": "Real-time updates unavailable",
            "error_message": "Please use polling fallback",
        })
        await websocket.close(code=1011, reason="Redis unavailable")
        return

    try:
        deadline = asyncio.get_event_loop().time() + WS_TIMEOUT_SECONDS

        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                logger.info("WebSocket timeout for analysis %s", analysis_id)
                await websocket.send_json({
                    "status": "error",
                    "progress": 0,
                    "current_step": "Connection timed out",
                    "error_message": "WebSocket timed out after 5 minutes",
                })
                break

            try:
                # Wait for next message from Redis Pub/Sub
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=min(5.0, remaining),
                )
            except asyncio.TimeoutError:
                # No message yet -- send a heartbeat ping to keep connection alive
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
                continue

            if message is None:
                continue

            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                except (json.JSONDecodeError, TypeError):
                    continue

                # Forward the progress update to the WebSocket client
                await websocket.send_json(data)

                # Close on terminal state
                if data.get("status") in ("completed", "failed"):
                    break

    except WebSocketDisconnect:
        logger.debug("Client disconnected from WS analysis %s", analysis_id)
    except Exception as e:
        logger.error("WebSocket error for analysis %s: %s", analysis_id, str(e)[:200])
    finally:
        # Clean up Redis subscription
        try:
            await pubsub.unsubscribe(channel_name)
            await pubsub.aclose()
            await redis_client.aclose()
        except Exception:
            pass

        try:
            await websocket.close(code=1000)
        except Exception:
            pass


async def publish_progress(
    redis_client: aioredis.Redis | None,
    analysis_id: str,
    status: str,
    progress: int,
    current_step: str,
    error_message: str | None = None,
) -> None:
    """
    Publish an analysis progress update to Redis Pub/Sub.

    Called from analysis_service.py at each pipeline stage. If Redis is
    unavailable, silently degrades (clients fall back to polling).

    Args:
        redis_client: Redis connection (from dependency injection or direct).
        analysis_id: UUID string of the analysis.
        status: Current status (queued/processing/completed/failed).
        progress: 0-100 percentage.
        current_step: Human-readable description of current stage.
        error_message: Error details if status is 'failed'.
    """
    if redis_client is None:
        return

    channel = _pubsub_channel(analysis_id)
    payload = json.dumps({
        "status": status,
        "progress": progress,
        "current_step": current_step,
        "error_message": error_message,
    })

    try:
        await redis_client.publish(channel, payload)
    except Exception as e:
        logger.warning(
            "Failed to publish progress for analysis %s: %s",
            analysis_id,
            str(e)[:200],
        )
