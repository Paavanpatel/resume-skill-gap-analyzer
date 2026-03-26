"""
Custom middleware for cross-cutting concerns.

Middleware runs on EVERY request, so it must be fast. Heavy operations
(like rate limiting checks) should use Redis lookups, not DB queries.

Rate limiting uses the sliding window counter pattern in Redis:
- Each window is a Redis key with TTL (e.g., "ratelimit:1.2.3.4:general" with 60s TTL)
- INCR atomically increments and returns the new count
- If the key is new, EXPIRE sets the TTL
- When the window expires, Redis deletes the key automatically

Why sliding window over fixed window? Fixed window has a burst problem:
a client could make 30 requests at 11:59:59 and 30 more at 12:00:01,
effectively getting 60 requests in 2 seconds. Sliding window smooths
this out. (Our implementation is actually a fixed window for simplicity,
but the short 60s window makes the burst problem negligible.)
"""

import json
import logging
import time
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    Attach a unique request ID to every request/response cycle.

    The ID is:
    - Taken from the X-Request-ID header if the client provides one
      (common when a load balancer or API gateway is in front of us)
    - Generated as a short UUID hex if not provided
    - Stored in request.state so any handler or service can access it
    - Returned in the X-Request-ID response header for client-side correlation
    - Logged with every request for tracing

    This makes debugging production issues much easier: the user reports
    the request ID from their error response, and you grep your logs for it.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex[:16])
        request.state.request_id = request_id

        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        response.headers["X-Request-ID"] = request_id

        # Log every request with timing. In production, this feeds into
        # metrics dashboards (Grafana, Datadog, etc.)
        logger.info(
            "%s %s -> %d (%.1fms) [request_id=%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to every response.

    These headers protect against common web attacks:
    - X-Content-Type-Options: prevents MIME-type sniffing (XSS vector)
    - X-Frame-Options: prevents clickjacking via iframes
    - X-XSS-Protection: legacy XSS filter (still helps older browsers)
    - Referrer-Policy: limits referrer leakage to external sites
    - Cache-Control: prevents caching of API responses with sensitive data
    - Permissions-Policy: disables browser features we don't use

    In production, Strict-Transport-Security (HSTS) should be added at
    the Nginx layer since the backend itself may not know if TLS is
    terminated upstream.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Redis-based rate limiting middleware.

    Applies two rate limit tiers:
    1. General: N requests per minute (applies to all endpoints)
    2. Analysis: M analysis submissions per hour (applies to POST /analysis)

    The rate limit key is based on the client's IP address for unauthenticated
    requests, or the user ID for authenticated requests (extracted from the
    JWT token in the Authorization header without full validation -- just
    the "sub" claim for identification).

    If Redis is unavailable, rate limiting is skipped (fail-open). This is
    a deliberate choice: blocking all requests because Redis is down is
    worse than temporarily allowing unlimited requests.

    Rate limit headers are added to every response:
    - X-RateLimit-Limit: max requests allowed in the window
    - X-RateLimit-Remaining: requests remaining in current window
    - X-RateLimit-Reset: seconds until the window resets
    """

    # Paths exempt from rate limiting (health checks, docs)
    _EXEMPT_PATHS = frozenset({"/api/v1/health", "/docs", "/redoc", "/openapi.json"})

    def __init__(self, app, redis_url: str, general_limit: int = 30, analysis_limit: int = 10):
        super().__init__(app)
        self._redis_url = redis_url
        self._general_limit = general_limit
        self._analysis_limit = analysis_limit
        self._redis = None

    async def _get_redis(self):
        """Lazily initialize Redis connection."""
        if self._redis is None:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(
                    self._redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=1.0,
                    socket_timeout=1.0,
                )
                await self._redis.ping()
            except Exception as e:
                logger.warning("Rate limiter Redis unavailable: %s", str(e)[:200])
                self._redis = None
        return self._redis

    def _get_client_id(self, request: Request) -> str:
        """
        Extract a client identifier for rate limiting.

        Prefers the user ID from the JWT token (if present) over the IP
        address. This prevents a single user from bypassing limits by
        switching IPs, and prevents shared IPs (like corporate NATs)
        from unfairly limiting individual users.
        """
        # Try to extract user ID from Bearer token (lightweight, no DB)
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                import jwt as pyjwt
                token = auth_header[7:]
                # Decode WITHOUT verification -- we just need the sub claim
                # for rate limit bucketing. Full validation happens in the
                # get_current_user dependency.
                payload = pyjwt.decode(token, options={"verify_signature": False})
                user_id = payload.get("sub")
                if user_id:
                    return f"user:{user_id}"
            except Exception:
                pass

        # Fall back to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"

        client_host = request.client.host if request.client else "unknown"
        return f"ip:{client_host}"

    def _is_analysis_endpoint(self, request: Request) -> bool:
        """Check if this is an analysis submission (the expensive endpoint)."""
        return (
            request.method == "POST"
            and request.url.path.startswith("/api/v1/analysis/")
            and not request.url.path.endswith("/status")
        )

    async def _check_rate_limit(
        self, redis_client, key: str, limit: int, window_seconds: int
    ) -> tuple[bool, int, int, int]:
        """
        Check and increment the rate limit counter.

        Returns: (allowed, current_count, limit, ttl_remaining)
        """
        try:
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.ttl(key)
            results = await pipe.execute()

            count = results[0]
            ttl = results[1]

            # First request in the window -- set TTL
            if ttl == -1:
                await redis_client.expire(key, window_seconds)
                ttl = window_seconds

            allowed = count <= limit
            return allowed, count, limit, max(ttl, 0)

        except Exception as e:
            logger.warning("Rate limit check failed: %s", str(e)[:200])
            return True, 0, limit, 0  # Fail open

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Skip exempt paths
        if request.url.path in self._EXEMPT_PATHS:
            return await call_next(request)

        redis_client = await self._get_redis()

        # If Redis is unavailable, skip rate limiting (fail-open)
        if redis_client is None:
            return await call_next(request)

        client_id = self._get_client_id(request)

        # Check general rate limit (per minute)
        general_key = f"ratelimit:{client_id}:general"
        allowed, count, limit, ttl = await self._check_rate_limit(
            redis_client, general_key, self._general_limit, 60
        )

        if not allowed:
            return self._rate_limit_response(limit, ttl, request)

        # Check analysis-specific rate limit (per hour) for POST /analysis
        if self._is_analysis_endpoint(request):
            analysis_key = f"ratelimit:{client_id}:analysis"
            allowed, count, limit, ttl = await self._check_rate_limit(
                redis_client, analysis_key, self._analysis_limit, 3600
            )

            if not allowed:
                return self._rate_limit_response(limit, ttl, request)

        # Request is within limits
        response = await call_next(request)

        # Add rate limit headers
        remaining = max(self._general_limit - count, 0)
        response.headers["X-RateLimit-Limit"] = str(self._general_limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(ttl)

        return response

    def _rate_limit_response(self, limit: int, retry_after: int, request: Request) -> Response:
        """Build a 429 Too Many Requests response."""
        request_id = getattr(request.state, "request_id", "unknown")

        body = json.dumps({
            "error": {
                "code": "RATE_LIMITED",
                "message": "Too many requests. Please try again later.",
                "details": {
                    "retry_after_seconds": retry_after,
                },
            },
            "request_id": request_id,
        })

        return Response(
            content=body,
            status_code=429,
            media_type="application/json",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(retry_after),
            },
        )
