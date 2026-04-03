"""
LLM client abstraction with provider fallback (circuit breaker pattern).

Supports OpenAI and Anthropic. If the primary provider fails, it
automatically falls back to the secondary. This protects against:
- API outages (OpenAI goes down -> switch to Anthropic)
- Rate limiting (429s from one provider -> try the other)
- Transient errors (network blips, timeouts)

The circuit breaker tracks consecutive failures. After 3 failures,
the primary provider is "tripped" and all requests go to the fallback
for a cooldown period (60s). After cooldown, it retries the primary.

Why not just retry the same provider? Because LLM API outages tend to
last minutes to hours. Retrying the same failing endpoint wastes time
and hits rate limits. Switching providers gives the user their result
while the primary recovers.
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.exceptions import AppError, ErrorCode

logger = logging.getLogger(__name__)


class LLMError(AppError):
    """Raised when all LLM providers fail."""

    def __init__(self, message: str = "AI service is temporarily unavailable."):
        super().__init__(
            message=message,
            error_code=ErrorCode.AI_PROVIDER_ERROR,
            status_code=503,
        )


@dataclass
class LLMResponse:
    """Standardized response from any LLM provider."""
    content: str
    provider: str  # "openai" or "anthropic"
    model: str
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    def parse_json(self) -> dict:
        """
        Extract and parse JSON from the response content.

        LLMs sometimes wrap JSON in markdown code blocks. This handles
        both clean JSON and ```json ... ``` wrapped responses.
        """
        text = self.content.strip()

        # Strip markdown code block wrappers if present
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first line (```json) and last line (```)
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse LLM JSON response: %s", e)
            raise LLMError(
                f"AI returned invalid JSON. This is usually transient -- please retry."
            ) from e


class CircuitBreaker:
    """
    Thread/async-safe circuit breaker for LLM provider failover.

    States:
    - CLOSED (normal): requests go to primary provider
    - OPEN (tripped): requests go to fallback provider
    - HALF_OPEN (testing): one request goes to primary to see if it recovered

    Uses an asyncio.Lock to prevent race conditions when multiple
    concurrent requests try to update state simultaneously.
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout_seconds: float = 60.0,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._state = "closed"  # closed | open | half_open
        self._lock = asyncio.Lock()

    async def record_success(self) -> None:
        """Reset on successful request."""
        async with self._lock:
            self._failure_count = 0
            self._state = "closed"

    async def record_failure(self) -> None:
        """Increment failure counter and trip if threshold reached."""
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()
            if self._failure_count >= self.failure_threshold:
                self._state = "open"
                logger.warning(
                    "Circuit breaker TRIPPED after %d failures. "
                    "Switching to fallback provider for %ds.",
                    self._failure_count,
                    self.recovery_timeout_seconds,
                )

    async def should_use_fallback(self) -> bool:
        """Check if we should route to the fallback provider."""
        async with self._lock:
            if self._state == "closed":
                return False

            # Check if recovery timeout has elapsed
            elapsed = time.time() - self._last_failure_time
            if elapsed >= self.recovery_timeout_seconds:
                self._state = "half_open"
                logger.info("Circuit breaker HALF-OPEN. Testing primary provider.")
                return False  # Try primary once

            return True  # Still in cooldown, use fallback


class RedisCircuitBreaker:
    """
    Redis-backed circuit breaker shared across all Celery workers / processes.

    Solves the per-process isolation problem: with a plain in-memory
    CircuitBreaker, each worker has its own state, so worker-1 can trip
    while workers 2–4 keep hammering the failing provider. This class
    stores state in Redis so every worker sees the same picture.

    Redis key layout (per provider name):
      circuit_breaker:{provider}:failures  — INCR counter; auto-expires
      circuit_breaker:{provider}:state     — "open" string with TTL = recovery_timeout
        → when TTL expires the key disappears, which is the auto-recovery signal

    Graceful degradation: if Redis is unavailable (down, network issue),
    all operations fall through to an in-process CircuitBreaker so LLM
    calls are never blocked by a Redis failure.
    """

    def __init__(
        self,
        provider: str = "primary",
        failure_threshold: int = 3,
        recovery_timeout_seconds: float = 60.0,
    ):
        self._provider = provider
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout_seconds
        # In-process fallback used when Redis is unavailable
        self._fallback = CircuitBreaker(failure_threshold, recovery_timeout_seconds)

    def _failures_key(self) -> str:
        return f"circuit_breaker:{self._provider}:failures"

    def _state_key(self) -> str:
        return f"circuit_breaker:{self._provider}:state"

    async def _get_redis(self):
        """Lazily resolve the Redis client; returns None if unavailable."""
        try:
            from app.core.dependencies import get_redis  # lazy to avoid circular import
            return await get_redis()
        except Exception:
            return None

    async def record_success(self) -> None:
        """Reset circuit breaker: delete both Redis keys and the in-process fallback."""
        redis = await self._get_redis()
        if redis is not None:
            try:
                await redis.delete(self._failures_key(), self._state_key())
            except Exception as e:
                logger.warning("RedisCircuitBreaker.record_success failed: %s", e)
        # Always reset the in-process fallback so its state stays consistent
        # if Redis was previously unavailable and accumulated failures.
        await self._fallback.record_success()

    async def record_failure(self) -> None:
        """Increment failure count; trip to open state when threshold reached."""
        redis = await self._get_redis()
        if redis is not None:
            try:
                count = await redis.incr(self._failures_key())
                # Keep failures key alive 3× longer than the open window for diagnostics
                await redis.expire(self._failures_key(), int(self._recovery_timeout * 3))
                if count >= self._failure_threshold:
                    await redis.set(
                        self._state_key(), "open", ex=int(self._recovery_timeout)
                    )
                    logger.warning(
                        "Circuit breaker TRIPPED (Redis) after %d failures. "
                        "Switching to fallback provider for %ds.",
                        count,
                        self._recovery_timeout,
                    )
                return
            except Exception as e:
                logger.warning("RedisCircuitBreaker.record_failure failed: %s", e)
        await self._fallback.record_failure()

    async def should_use_fallback(self) -> bool:
        """Return True if the state key exists and equals 'open' in Redis."""
        redis = await self._get_redis()
        if redis is not None:
            try:
                state = await redis.get(self._state_key())
                return state == "open"
            except Exception as e:
                logger.warning("RedisCircuitBreaker.should_use_fallback failed: %s", e)
        return await self._fallback.should_use_fallback()


# Module-level circuit breaker — shared across requests in this process.
# RedisCircuitBreaker additionally shares state across all Celery worker
# processes via Redis, eliminating the per-process isolation problem.
_circuit_breaker = RedisCircuitBreaker()


async def _call_openai(
    messages: list[dict],
    model: str,
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> LLMResponse:
    """Call OpenAI's chat completions API."""
    settings = get_settings()

    if not settings.openai_api_key:
        raise LLMError("OpenAI API key is not configured.")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )

        if response.status_code != 200:
            error_body = response.text[:500]
            logger.error("OpenAI API error %d: %s", response.status_code, error_body)
            raise LLMError(f"OpenAI API returned status {response.status_code}")

        data = response.json()
        choice = data["choices"][0]
        usage = data.get("usage", {})

        return LLMResponse(
            content=choice["message"]["content"],
            provider="openai",
            model=model,
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
        )


async def _call_anthropic(
    messages: list[dict],
    model: str,
    temperature: float = 0.1,
    max_tokens: int = 4096,
    system_prompt: str | None = None,
) -> LLMResponse:
    """Call Anthropic's messages API."""
    settings = get_settings()

    if not settings.anthropic_api_key:
        raise LLMError("Anthropic API key is not configured.")

    # Anthropic uses a different message format: system is separate from messages
    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if system_prompt:
        body["system"] = system_prompt

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json=body,
        )

        if response.status_code != 200:
            error_body = response.text[:500]
            logger.error("Anthropic API error %d: %s", response.status_code, error_body)
            raise LLMError(f"Anthropic API returned status {response.status_code}")

        data = response.json()
        usage = data.get("usage", {})

        # Anthropic returns content as a list of blocks
        content_blocks = data.get("content", [])
        content = "".join(
            block["text"] for block in content_blocks if block["type"] == "text"
        )

        return LLMResponse(
            content=content,
            provider="anthropic",
            model=model,
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
        )


async def call_llm(
    messages: list[dict],
    temperature: float = 0.1,
    max_tokens: int = 4096,
    system_prompt: str | None = None,
) -> LLMResponse:
    """
    Call the LLM with automatic provider fallback.

    This is the main entry point. It:
    1. Checks the circuit breaker to pick the provider
    2. Tries the selected provider
    3. Falls back to the other if the first fails
    4. Updates the circuit breaker based on success/failure

    Args:
        messages: Chat messages in OpenAI format [{"role": "user", "content": "..."}]
        temperature: Randomness (0.0 = deterministic, 1.0 = creative). We use 0.1
                     for skill extraction because we want consistent, structured output.
        max_tokens: Max output tokens.
        system_prompt: System-level instructions (handled differently per provider).

    Returns:
        LLMResponse with the content and usage metadata.

    Raises:
        LLMError: If both providers fail.
    """
    settings = get_settings()

    # Determine provider order based on circuit breaker state
    if await _circuit_breaker.should_use_fallback():
        providers = [
            (settings.ai_fallback_provider, None),
            (settings.ai_provider, None),
        ]
    else:
        providers = [
            (settings.ai_provider, None),
            (settings.ai_fallback_provider, None),
        ]

    last_error: Exception | None = None

    for provider_name, _ in providers:
        try:
            if provider_name == "openai":
                # OpenAI: system prompt goes in messages
                openai_messages = []
                if system_prompt:
                    openai_messages.append({"role": "system", "content": system_prompt})
                openai_messages.extend(messages)

                result = await _call_openai(
                    messages=openai_messages,
                    model=settings.openai_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            elif provider_name == "anthropic":
                result = await _call_anthropic(
                    messages=messages,
                    model=settings.anthropic_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    system_prompt=system_prompt,
                )
            else:
                logger.error("Unknown AI provider: %s", provider_name)
                continue

            # Success: reset circuit breaker
            await _circuit_breaker.record_success()
            logger.info(
                "LLM call succeeded: provider=%s, model=%s, tokens=%d",
                result.provider,
                result.model,
                result.total_tokens,
            )
            return result

        except LLMError as e:
            # Config errors (no API key) should not trigger fallback.
            # API errors (status codes, bad JSON) SHOULD try fallback.
            if "not configured" in str(e):
                raise
            last_error = e
            await _circuit_breaker.record_failure()
            logger.warning(
                "LLM provider '%s' returned error: %s. Trying fallback...",
                provider_name,
                str(e)[:200],
            )
            continue
        except Exception as e:
            last_error = e
            await _circuit_breaker.record_failure()
            logger.warning(
                "LLM provider '%s' failed: %s. Trying fallback...",
                provider_name,
                str(e)[:200],
            )
            continue

    # Both providers failed
    raise LLMError(
        "All AI providers are currently unavailable. Please try again in a few minutes."
    )
