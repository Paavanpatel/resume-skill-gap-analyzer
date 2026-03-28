"""
Custom middleware for cross-cutting concerns.

Middleware runs on EVERY request, so it must be fast. Heavy operations
(like rate limiting checks) should use Redis lookups, not DB queries.

Rate limiting uses the true sliding window pattern via Redis sorted sets:
- Each request is stored as a member with score = Unix timestamp (ms)
- ZREMRANGEBYSCORE removes entries older than the window before counting
- ZADD + ZCARD in an atomic pipeline (MULTI/EXEC) give exact counts
- The key expires automatically via EXPIRE as a safety net

True sliding window vs. fixed window: a fixed window lets a client burst
at the seam (30 req at 11:59:59 + 30 more at 12:00:01 = 60 in 2s).
The sorted-set approach prevents this because we always count requests
within the last N seconds from *now*, not from the start of a clock cycle.

Auth brute-force protection applies a stricter IP-based limit on POST
/auth/login and /auth/register endpoints, regardless of whether the
client is authenticated.
"""

import json
import logging
import time
import uuid

import structlog
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

        # Bind request context to structlog so every log line in this request
        # automatically carries request_id, method, and path without manual passing.
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            http_method=request.method,
            http_path=request.url.path,
        )

        start_time = time.perf_counter()
        response = await call_next(request)
        duration_s = time.perf_counter() - start_time
        duration_ms = duration_s * 1000

        response.headers["X-Request-ID"] = request_id

        # Record Prometheus HTTP metrics (import lazily to avoid circular imports
        # if metrics.py ever imports from middleware in the future)
        try:
            from app.core.metrics import http_requests_total, http_request_duration_seconds
            # Normalise path for high-cardinality routes (e.g. /analysis/{id})
            path_label = _normalise_path(request.url.path)
            status_label = str(response.status_code)
            http_requests_total.labels(
                method=request.method, path=path_label, status=status_label
            ).inc()
            http_request_duration_seconds.labels(
                method=request.method, path=path_label
            ).observe(duration_s)
        except Exception:
            pass  # Never let metrics recording crash a request

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


def _normalise_path(path: str) -> str:
    """
    Replace path segments that look like UUIDs or numeric IDs with a
    placeholder to prevent unbounded label cardinality in Prometheus.

    Examples:
      /api/v1/analysis/abc123def456  ->  /api/v1/analysis/{id}
      /api/v1/resume/42              ->  /api/v1/resume/{id}
    """
    import re
    # UUID-shaped segments (hex, 8-4-4-4-12 or 32 hex chars)
    path = re.sub(r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "/{id}", path)
    path = re.sub(r"/[0-9a-f]{32}", "/{id}", path)
    # Pure numeric segments
    path = re.sub(r"/\d+", "/{id}", path)
    return path


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Redis sliding-window rate limiting middleware.

    Applies three rate limit tiers:
    1. Auth brute-force: M attempts per 15 minutes per IP on login/register
    2. General: N requests per minute per client (user ID or IP)
    3. Analysis: P analysis submissions per hour per client

    Sliding window implementation (sorted sets + MULTI/EXEC pipeline):
    - Each request stored as a member with score = epoch ms
    - ZREMRANGEBYSCORE prunes expired entries before counting
    - ZADD + ZCARD run in one atomic pipeline transaction
    - If over limit, the just-added member is removed (deny without counting)
    - EXPIRE on the key ensures Redis cleans up stale windows automatically

    Client identification:
    - Authenticated requests: keyed by user ID (prevents IP-switching bypass)
    - Unauthenticated requests: keyed by IP address
    - Auth endpoints always use IP (brute force targets anonymous attempts)

    Fail-open: if Redis is unavailable, rate limiting is skipped. Blocking
    all traffic because Redis is down is worse than temporary unlimited access.

    Response headers on every non-exempt response:
    - X-RateLimit-Limit: max requests in the window
    - X-RateLimit-Remaining: requests remaining
    - X-RateLimit-Reset: seconds until the window resets
    """

    # Paths that bypass rate limiting entirely
    _EXEMPT_PATHS = frozenset({
        "/api/v1/health",
        "/api/v1/health/live",
        "/api/v1/health/ready",
        "/api/v1/metrics",
        "/docs",
        "/redoc",
        "/openapi.json",
    })

    # Auth endpoints that get stricter IP-based brute-force protection
    _AUTH_PATHS = frozenset({"/api/v1/auth/login", "/api/v1/auth/register"})

    def __init__(
        self,
        app,
        redis_url: str,
        general_limit: int = 30,
        analysis_limit: int = 10,
        auth_limit: int = 20,
    ):
        super().__init__(app)
        self._redis_url = redis_url
        self._general_limit = general_limit
        self._analysis_limit = analysis_limit
        self._auth_limit = auth_limit
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
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                import jwt as pyjwt

                token = auth_header[7:]
                # Decode WITHOUT verification — just need the sub claim for
                # rate limit bucketing. Full validation happens in get_current_user.
                payload = pyjwt.decode(token, options={"verify_signature": False})
                user_id = payload.get("sub")
                if user_id:
                    return f"user:{user_id}"
            except Exception:
                pass

        return self._get_ip(request)

    def _get_ip(self, request: Request) -> str:
        """Extract client IP address for IP-based rate limiting."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
        client_host = request.client.host if request.client else "unknown"
        return f"ip:{client_host}"

    def _is_analysis_endpoint(self, request: Request) -> bool:
        """Check if this is an analysis submission (the expensive endpoint).

        Both new submissions and retries consume AI resources, so both count
        against the per-hour analysis limit. Only status polls are excluded.
        """
        return (
            request.method == "POST"
            and request.url.path.startswith("/api/v1/analysis/")
            and not request.url.path.endswith("/status")
        )

    async def _check_rate_limit(
        self, redis_client, key: str, limit: int, window_seconds: int
    ) -> tuple[bool, int, int, int]:
        """
        True sliding window rate limit check using Redis sorted sets.

        Pipeline (MULTI/EXEC) steps:
        1. ZREMRANGEBYSCORE — remove entries older than window_start
        2. ZADD — record this request with current timestamp as score
        3. ZCARD — count entries in the current window
        4. EXPIRE — ensure the key eventually cleans up

        If the count exceeds the limit, the just-added member is removed
        (the request is denied without being counted toward the window).

        Returns: (allowed, current_count, limit, ttl_remaining)
        """
        now_ms = int(time.time() * 1000)
        window_start_ms = now_ms - (window_seconds * 1000)
        member = f"{now_ms}-{uuid.uuid4().hex[:8]}"

        try:
            async with redis_client.pipeline(transaction=True) as pipe:
                pipe.zremrangebyscore(key, 0, window_start_ms)
                pipe.zadd(key, {member: now_ms})
                pipe.zcard(key)
                pipe.expire(key, window_seconds + 1)
                results = await pipe.execute()

            count = results[2]  # ZCARD result (includes just-added entry)

            if count > limit:
                # Remove the entry we just added — request is denied
                await redis_client.zrem(key, member)
                return False, count - 1, limit, window_seconds

            return True, count, limit, window_seconds

        except Exception as e:
            logger.warning("Rate limit check failed for key=%s: %s", key, str(e)[:200])
            return True, 0, limit, 0  # Fail open

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Skip exempt paths (health checks, API docs)
        if request.url.path in self._EXEMPT_PATHS:
            return await call_next(request)

        redis_client = await self._get_redis()

        # If Redis is unavailable, skip rate limiting (fail-open)
        if redis_client is None:
            return await call_next(request)

        # ── Auth brute-force protection (IP-based, stricter) ──────────
        if request.method == "POST" and request.url.path in self._AUTH_PATHS:
            ip_id = self._get_ip(request)
            auth_key = f"ratelimit:{ip_id}:auth"
            allowed, _, _, ttl = await self._check_rate_limit(
                redis_client, auth_key, self._auth_limit, 900  # 15-minute window
            )
            if not allowed:
                return self._rate_limit_response(self._auth_limit, ttl, request)

        client_id = self._get_client_id(request)

        # ── General rate limit (per minute) ──────────────────────────
        general_key = f"ratelimit:{client_id}:general"
        allowed, count, limit, ttl = await self._check_rate_limit(
            redis_client, general_key, self._general_limit, 60
        )

        if not allowed:
            return self._rate_limit_response(limit, ttl, request)

        # ── Analysis-specific rate limit (per hour) ───────────────────
        if self._is_analysis_endpoint(request):
            analysis_key = f"ratelimit:{client_id}:analysis"
            allowed, _, a_limit, a_ttl = await self._check_rate_limit(
                redis_client, analysis_key, self._analysis_limit, 3600
            )
            if not allowed:
                return self._rate_limit_response(a_limit, a_ttl, request)

        # ── Request is within limits — proceed ────────────────────────
        response = await call_next(request)

        remaining = max(self._general_limit - count, 0)
        response.headers["X-RateLimit-Limit"] = str(self._general_limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(ttl)

        return response

    def _rate_limit_response(
        self, limit: int, retry_after: int, request: Request
    ) -> Response:
        """Build a 429 Too Many Requests response."""
        request_id = getattr(request.state, "request_id", "unknown")

        body = json.dumps(
            {
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Too many requests. Please try again later.",
                    "details": {
                        "retry_after_seconds": retry_after,
                    },
                },
                "request_id": request_id,
            }
        )

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
