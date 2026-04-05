"""
Comprehensive tests for the LLM client.

Covers:
- LLMResponse.parse_json() (JSON extraction from LLM output)
- CircuitBreaker state transitions
- Prompt builders
- _call_openai() and _call_anthropic() with mocked httpx
- call_llm() provider fallback logic
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm_client import (
    CircuitBreaker,
    LLMError,
    LLMResponse,
    RedisCircuitBreaker,
    _call_anthropic,
    _call_openai,
    _circuit_breaker,
    call_llm,
)
from app.services.prompts import (
    build_job_extraction_prompt,
    build_resume_extraction_prompt,
)


class TestLLMResponseParseJson:
    """Test JSON extraction from LLM responses."""

    def test_clean_json(self):
        response = LLMResponse(
            content='{"skills": [{"name": "Python"}]}',
            provider="openai",
            model="gpt-4o",
        )
        data = response.parse_json()
        assert data["skills"][0]["name"] == "Python"

    def test_markdown_wrapped_json(self):
        response = LLMResponse(
            content='```json\n{"skills": [{"name": "Docker"}]}\n```',
            provider="openai",
            model="gpt-4o",
        )
        data = response.parse_json()
        assert data["skills"][0]["name"] == "Docker"

    def test_markdown_no_language_tag(self):
        response = LLMResponse(
            content='```\n{"skills": []}\n```',
            provider="openai",
            model="gpt-4o",
        )
        data = response.parse_json()
        assert data["skills"] == []

    def test_whitespace_around_json(self):
        response = LLMResponse(
            content='  \n  {"skills": []} \n  ',
            provider="openai",
            model="gpt-4o",
        )
        data = response.parse_json()
        assert data["skills"] == []

    def test_invalid_json_raises_error(self):
        response = LLMResponse(
            content="This is not JSON at all",
            provider="openai",
            model="gpt-4o",
        )
        with pytest.raises(LLMError):
            response.parse_json()

    def test_total_tokens_property(self):
        response = LLMResponse(
            content="",
            provider="openai",
            model="gpt-4o",
            input_tokens=100,
            output_tokens=50,
        )
        assert response.total_tokens == 150


class TestCircuitBreaker:
    """Test circuit breaker state machine."""

    @pytest.mark.asyncio
    async def test_starts_closed(self):
        cb = CircuitBreaker()
        assert await cb.should_use_fallback() is False

    @pytest.mark.asyncio
    async def test_stays_closed_below_threshold(self):
        cb = CircuitBreaker(failure_threshold=3)
        await cb.record_failure()
        await cb.record_failure()
        assert await cb.should_use_fallback() is False

    @pytest.mark.asyncio
    async def test_trips_at_threshold(self):
        cb = CircuitBreaker(failure_threshold=3)
        await cb.record_failure()
        await cb.record_failure()
        await cb.record_failure()
        assert await cb.should_use_fallback() is True

    @pytest.mark.asyncio
    async def test_success_resets(self):
        cb = CircuitBreaker(failure_threshold=3)
        await cb.record_failure()
        await cb.record_failure()
        await cb.record_success()
        assert await cb.should_use_fallback() is False
        await cb.record_failure()
        await cb.record_failure()
        assert await cb.should_use_fallback() is False

    @pytest.mark.asyncio
    async def test_recovery_after_timeout(self):
        import asyncio

        cb = CircuitBreaker(failure_threshold=1, recovery_timeout_seconds=0.1)
        await cb.record_failure()
        assert await cb.should_use_fallback() is True
        await asyncio.sleep(0.15)
        assert await cb.should_use_fallback() is False


class _FakeRedis:
    """Minimal in-memory Redis stand-in for unit tests."""

    def __init__(self):
        self._store: dict[str, str] = {}
        self._counts: dict[str, int] = {}

    async def incr(self, key: str) -> int:
        self._counts[key] = self._counts.get(key, 0) + 1
        return self._counts[key]

    async def expire(self, key: str, ttl: int) -> None:
        pass  # TTL not simulated; test_recovery uses real sleep or manual deletion

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._store[key] = value

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def delete(self, *keys: str) -> None:
        for key in keys:
            self._store.pop(key, None)
            self._counts.pop(key, None)


class TestRedisCircuitBreaker:
    """Tests for RedisCircuitBreaker with a fake in-memory Redis."""

    def _make_breaker(self, **kwargs) -> tuple["RedisCircuitBreaker", _FakeRedis]:
        fake = _FakeRedis()
        cb = RedisCircuitBreaker(**kwargs)

        # Inject fake Redis by patching _get_redis on this instance
        async def _fake_get_redis():
            return fake

        cb._get_redis = _fake_get_redis
        return cb, fake

    @pytest.mark.asyncio
    async def test_starts_closed(self):
        cb, _ = self._make_breaker()
        assert await cb.should_use_fallback() is False

    @pytest.mark.asyncio
    async def test_trips_after_threshold_failures(self):
        """After failure_threshold failures the Redis breaker opens."""
        cb, _ = self._make_breaker(failure_threshold=3)
        await cb.record_failure()
        await cb.record_failure()
        assert await cb.should_use_fallback() is False  # still closed at 2
        await cb.record_failure()
        assert await cb.should_use_fallback() is True  # open at 3

    @pytest.mark.asyncio
    async def test_recovery_after_timeout(self):
        """After the TTL expires (simulated by deleting the state key), breaker closes."""
        cb, fake = self._make_breaker(failure_threshold=1)
        await cb.record_failure()
        assert await cb.should_use_fallback() is True

        # Simulate Redis TTL expiry: remove the state key
        await fake.delete(cb._state_key())
        assert await cb.should_use_fallback() is False

    @pytest.mark.asyncio
    async def test_success_resets(self):
        cb, _ = self._make_breaker(failure_threshold=2)
        await cb.record_failure()
        await cb.record_failure()
        assert await cb.should_use_fallback() is True
        await cb.record_success()
        assert await cb.should_use_fallback() is False

    @pytest.mark.asyncio
    async def test_redis_unavailable_falls_back_to_in_process(self):
        """When Redis is down, falls back to in-process CircuitBreaker."""
        cb = RedisCircuitBreaker(failure_threshold=3)

        # _get_redis returns None → Redis unavailable
        async def _no_redis():
            return None

        cb._get_redis = _no_redis

        await cb.record_failure()
        await cb.record_failure()
        assert await cb.should_use_fallback() is False  # in-process: 2 < threshold

        await cb.record_failure()
        assert await cb.should_use_fallback() is True  # in-process: 3 >= threshold

    @pytest.mark.asyncio
    async def test_redis_error_falls_back_to_in_process(self):
        """Redis raising an exception is treated the same as unavailable."""
        cb = RedisCircuitBreaker(failure_threshold=2)

        class _BrokenRedis:
            async def incr(self, key):
                raise ConnectionError("Redis is gone")

            async def expire(self, key, ttl):
                raise ConnectionError("Redis is gone")

            async def set(self, key, value, ex=None):
                raise ConnectionError("Redis is gone")

            async def get(self, key):
                raise ConnectionError("Redis is gone")

            async def delete(self, *keys):
                raise ConnectionError("Redis is gone")

        async def _broken_redis():
            return _BrokenRedis()

        cb._get_redis = _broken_redis

        # Failures fall through to in-process breaker
        await cb.record_failure()
        await cb.record_failure()
        assert await cb.should_use_fallback() is True


class TestCallOpenAI:
    """Tests for _call_openai with mocked httpx."""

    @pytest.mark.asyncio
    async def test_successful_call(self):
        """OpenAI call returns LLMResponse on 200."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": '{"skills": []}'}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 50},
        }

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)

        mock_settings = MagicMock()
        mock_settings.openai_api_key = "sk-test-key"

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client.httpx.AsyncClient", return_value=mock_client
            ),
        ):
            result = await _call_openai(
                messages=[{"role": "user", "content": "test"}],
                model="gpt-4o",
            )

        assert result.provider == "openai"
        assert result.model == "gpt-4o"
        assert result.content == '{"skills": []}'
        assert result.input_tokens == 100
        assert result.output_tokens == 50

    @pytest.mark.asyncio
    async def test_no_api_key_raises(self):
        """LLMError when API key is missing."""
        mock_settings = MagicMock()
        mock_settings.openai_api_key = ""

        with patch("app.services.llm_client.get_settings", return_value=mock_settings):
            with pytest.raises(LLMError, match="not configured"):
                await _call_openai([{"role": "user", "content": "test"}], "gpt-4o")

    @pytest.mark.asyncio
    async def test_api_error_raises(self):
        """LLMError on non-200 status code."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Rate limited"

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)

        mock_settings = MagicMock()
        mock_settings.openai_api_key = "sk-test-key"

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client.httpx.AsyncClient", return_value=mock_client
            ),
        ):
            with pytest.raises(LLMError, match="status 429"):
                await _call_openai([{"role": "user", "content": "test"}], "gpt-4o")

    @pytest.mark.asyncio
    async def test_missing_usage_defaults_to_zero(self):
        """Missing usage data defaults to 0 tokens."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "{}"}}],
        }

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)

        mock_settings = MagicMock()
        mock_settings.openai_api_key = "sk-test-key"

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client.httpx.AsyncClient", return_value=mock_client
            ),
        ):
            result = await _call_openai([{"role": "user", "content": "test"}], "gpt-4o")

        assert result.input_tokens == 0
        assert result.output_tokens == 0


class TestCallAnthropic:
    """Tests for _call_anthropic with mocked httpx."""

    @pytest.mark.asyncio
    async def test_successful_call(self):
        """Anthropic call returns LLMResponse on 200."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "content": [{"type": "text", "text": '{"skills": []}'}],
            "usage": {"input_tokens": 80, "output_tokens": 40},
        }

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)

        mock_settings = MagicMock()
        mock_settings.anthropic_api_key = "sk-ant-test"

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client.httpx.AsyncClient", return_value=mock_client
            ),
        ):
            result = await _call_anthropic(
                messages=[{"role": "user", "content": "test"}],
                model="claude-sonnet-4-20250514",
            )

        assert result.provider == "anthropic"
        assert result.content == '{"skills": []}'
        assert result.input_tokens == 80
        assert result.output_tokens == 40

    @pytest.mark.asyncio
    async def test_no_api_key_raises(self):
        """LLMError when Anthropic API key is missing."""
        mock_settings = MagicMock()
        mock_settings.anthropic_api_key = ""

        with patch("app.services.llm_client.get_settings", return_value=mock_settings):
            with pytest.raises(LLMError, match="not configured"):
                await _call_anthropic(
                    [{"role": "user", "content": "test"}], "claude-sonnet-4-20250514"
                )

    @pytest.mark.asyncio
    async def test_api_error_raises(self):
        """LLMError on non-200 status code."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal error"

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)

        mock_settings = MagicMock()
        mock_settings.anthropic_api_key = "sk-ant-test"

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client.httpx.AsyncClient", return_value=mock_client
            ),
        ):
            with pytest.raises(LLMError, match="status 500"):
                await _call_anthropic(
                    [{"role": "user", "content": "test"}], "claude-sonnet-4-20250514"
                )

    @pytest.mark.asyncio
    async def test_with_system_prompt(self):
        """System prompt is included in the request body."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "content": [{"type": "text", "text": "{}"}],
            "usage": {"input_tokens": 10, "output_tokens": 5},
        }

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)

        mock_settings = MagicMock()
        mock_settings.anthropic_api_key = "sk-ant-test"

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client.httpx.AsyncClient", return_value=mock_client
            ),
        ):
            await _call_anthropic(
                messages=[{"role": "user", "content": "test"}],
                model="claude-sonnet-4-20250514",
                system_prompt="You are a helpful assistant",
            )

        # Verify system prompt was in the request body
        call_args = mock_client.post.call_args
        request_body = call_args.kwargs.get("json") or call_args[1].get("json")
        assert request_body["system"] == "You are a helpful assistant"

    @pytest.mark.asyncio
    async def test_multiple_content_blocks(self):
        """Multiple text blocks are concatenated."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "content": [
                {"type": "text", "text": "Hello "},
                {"type": "text", "text": "World"},
            ],
            "usage": {"input_tokens": 10, "output_tokens": 5},
        }

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)

        mock_settings = MagicMock()
        mock_settings.anthropic_api_key = "sk-ant-test"

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client.httpx.AsyncClient", return_value=mock_client
            ),
        ):
            result = await _call_anthropic(
                messages=[{"role": "user", "content": "test"}],
                model="claude-sonnet-4-20250514",
            )

        assert result.content == "Hello World"


class TestCallLLM:
    """Tests for the main call_llm entry point with fallback logic."""

    @pytest.mark.asyncio
    async def test_primary_openai_success(self):
        """Uses OpenAI as primary when circuit is closed."""
        mock_settings = MagicMock()
        mock_settings.ai_provider = "openai"
        mock_settings.ai_fallback_provider = "anthropic"
        mock_settings.openai_model = "gpt-4o"
        mock_settings.openai_api_key = "sk-test"

        mock_result = LLMResponse(
            content='{"test": true}',
            provider="openai",
            model="gpt-4o",
            input_tokens=10,
            output_tokens=5,
        )

        # Reset circuit breaker state
        await _circuit_breaker.record_success()

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client._call_openai",
                new_callable=AsyncMock,
                return_value=mock_result,
            ),
        ):
            result = await call_llm(messages=[{"role": "user", "content": "test"}])

        assert result.provider == "openai"

    @pytest.mark.asyncio
    async def test_fallback_on_primary_failure(self):
        """Falls back to Anthropic when OpenAI fails."""
        mock_settings = MagicMock()
        mock_settings.ai_provider = "openai"
        mock_settings.ai_fallback_provider = "anthropic"
        mock_settings.openai_model = "gpt-4o"
        mock_settings.anthropic_model = "claude-sonnet-4-20250514"
        mock_settings.openai_api_key = "sk-test"
        mock_settings.anthropic_api_key = "sk-ant-test"

        mock_fallback_result = LLMResponse(
            content='{"test": true}',
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            input_tokens=10,
            output_tokens=5,
        )

        await _circuit_breaker.record_success()

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client._call_openai",
                new_callable=AsyncMock,
                side_effect=LLMError("OpenAI API returned status 500"),
            ),
            patch(
                "app.services.llm_client._call_anthropic",
                new_callable=AsyncMock,
                return_value=mock_fallback_result,
            ),
        ):
            result = await call_llm(messages=[{"role": "user", "content": "test"}])

        assert result.provider == "anthropic"

    @pytest.mark.asyncio
    async def test_both_providers_fail_raises(self):
        """LLMError when both providers fail."""
        mock_settings = MagicMock()
        mock_settings.ai_provider = "openai"
        mock_settings.ai_fallback_provider = "anthropic"
        mock_settings.openai_model = "gpt-4o"
        mock_settings.anthropic_model = "claude-sonnet-4-20250514"
        mock_settings.openai_api_key = "sk-test"
        mock_settings.anthropic_api_key = "sk-ant-test"

        await _circuit_breaker.record_success()

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client._call_openai",
                new_callable=AsyncMock,
                side_effect=LLMError("OpenAI down"),
            ),
            patch(
                "app.services.llm_client._call_anthropic",
                new_callable=AsyncMock,
                side_effect=LLMError("Anthropic down"),
            ),
        ):
            with pytest.raises(LLMError, match="All AI providers"):
                await call_llm(messages=[{"role": "user", "content": "test"}])

    @pytest.mark.asyncio
    async def test_config_error_not_configured_raises_immediately(self):
        """'not configured' error does not trigger fallback."""
        mock_settings = MagicMock()
        mock_settings.ai_provider = "openai"
        mock_settings.ai_fallback_provider = "anthropic"
        mock_settings.openai_model = "gpt-4o"
        mock_settings.openai_api_key = ""

        await _circuit_breaker.record_success()

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client._call_openai",
                new_callable=AsyncMock,
                side_effect=LLMError("OpenAI API key is not configured."),
            ),
        ):
            with pytest.raises(LLMError, match="not configured"):
                await call_llm(messages=[{"role": "user", "content": "test"}])

    @pytest.mark.asyncio
    async def test_system_prompt_passed_to_openai(self):
        """System prompt is prepended to messages for OpenAI."""
        mock_settings = MagicMock()
        mock_settings.ai_provider = "openai"
        mock_settings.ai_fallback_provider = "anthropic"
        mock_settings.openai_model = "gpt-4o"
        mock_settings.openai_api_key = "sk-test"

        mock_result = LLMResponse(
            content="{}",
            provider="openai",
            model="gpt-4o",
        )

        mock_call = AsyncMock(return_value=mock_result)

        await _circuit_breaker.record_success()

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch("app.services.llm_client._call_openai", mock_call),
        ):
            await call_llm(
                messages=[{"role": "user", "content": "test"}],
                system_prompt="Be helpful",
            )

        # Verify system message was prepended
        call_args = mock_call.call_args
        messages_sent = (
            call_args.kwargs.get("messages") or call_args[1]["messages"]
            if len(call_args[1]) > 0
            else call_args.kwargs["messages"]
        )
        assert messages_sent[0]["role"] == "system"
        assert messages_sent[0]["content"] == "Be helpful"

    @pytest.mark.asyncio
    async def test_unknown_provider_skipped(self):
        """Unknown provider name is skipped gracefully."""
        mock_settings = MagicMock()
        mock_settings.ai_provider = "unknown_provider"
        mock_settings.ai_fallback_provider = "openai"
        mock_settings.openai_model = "gpt-4o"
        mock_settings.openai_api_key = "sk-test"

        mock_result = LLMResponse(
            content="{}",
            provider="openai",
            model="gpt-4o",
        )

        await _circuit_breaker.record_success()

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client._call_openai",
                new_callable=AsyncMock,
                return_value=mock_result,
            ),
        ):
            result = await call_llm(messages=[{"role": "user", "content": "test"}])

        assert result.provider == "openai"

    @pytest.mark.asyncio
    async def test_general_exception_triggers_fallback(self):
        """Non-LLMError exceptions also trigger fallback."""
        mock_settings = MagicMock()
        mock_settings.ai_provider = "openai"
        mock_settings.ai_fallback_provider = "anthropic"
        mock_settings.openai_model = "gpt-4o"
        mock_settings.anthropic_model = "claude-sonnet-4-20250514"
        mock_settings.openai_api_key = "sk-test"
        mock_settings.anthropic_api_key = "sk-ant-test"

        mock_result = LLMResponse(
            content="{}",
            provider="anthropic",
            model="claude-sonnet-4-20250514",
        )

        await _circuit_breaker.record_success()

        with (
            patch("app.services.llm_client.get_settings", return_value=mock_settings),
            patch(
                "app.services.llm_client._call_openai",
                new_callable=AsyncMock,
                side_effect=ConnectionError("network down"),
            ),
            patch(
                "app.services.llm_client._call_anthropic",
                new_callable=AsyncMock,
                return_value=mock_result,
            ),
        ):
            result = await call_llm(messages=[{"role": "user", "content": "test"}])

        assert result.provider == "anthropic"


class TestLLMError:
    """Tests for LLMError exception class."""

    def test_default_message(self):
        err = LLMError()
        assert "temporarily unavailable" in str(err)

    def test_custom_message(self):
        err = LLMError("Custom error message")
        assert str(err) == "Custom error message"

    def test_is_app_error(self):
        from app.core.exceptions import AppError

        err = LLMError()
        assert isinstance(err, AppError)

    def test_status_code_503(self):
        err = LLMError()
        assert err.status_code == 503


class TestPromptBuilders:
    """Test prompt template builders."""

    def test_resume_prompt_contains_text(self):
        prompt = build_resume_extraction_prompt("I know Python and Docker")
        assert "I know Python and Docker" in prompt
        assert "<resume>" in prompt
        assert "</resume>" in prompt

    def test_job_prompt_contains_text(self):
        prompt = build_job_extraction_prompt("Must have 5 years of Python")
        assert "Must have 5 years of Python" in prompt
        assert "<job_description>" in prompt
        assert "</job_description>" in prompt

    def test_resume_prompt_has_json_schema(self):
        prompt = build_resume_extraction_prompt("test")
        assert '"skills"' in prompt
        assert '"name"' in prompt
        assert '"confidence"' in prompt

    def test_job_prompt_has_required_field(self):
        prompt = build_job_extraction_prompt("test")
        assert '"required"' in prompt
