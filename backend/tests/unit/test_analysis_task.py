"""
Unit tests for the analysis Celery task retry logic.

Verifies:
- Non-retriable errors (NotFoundError, ParsingError, etc.) fail immediately
  without consuming the retry budget.
- Transient errors (ConnectionError, OSError) trigger retry with backoff.

Testing strategy: Use push_request() to inject a fake Celery request context
into the live task instance, then call task.run(analysis_id) directly. This
avoids the need for a broker while still exercising the actual task body.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.exceptions import NotFoundError, ParsingError, ValidationError
from app.workers.analysis_task import run_skill_gap_analysis, NON_RETRIABLE


def _run_task(analysis_id, retries=0, max_retries=2):
    """
    Execute the task body synchronously with a fake request context.
    Returns (mock_retry, raised_exception).
    """
    task = run_skill_gap_analysis._get_current_object()
    task.push_request(retries=retries)
    mock_retry = MagicMock(side_effect=Exception("Retry"))
    original_retry = task.__class__.retry

    try:
        task.__class__.retry = mock_retry
        task.run(analysis_id)
        return mock_retry, None
    except Exception as exc:
        return mock_retry, exc
    finally:
        task.__class__.retry = original_retry
        task.pop_request()


class TestNonRetriableErrors:
    """Non-retriable errors must propagate immediately without calling self.retry."""

    @pytest.mark.parametrize("exc_class", [
        NotFoundError,
        ParsingError,
        ValidationError,
        KeyError,
        ValueError,
        PermissionError,
    ])
    def test_fails_immediately(self, exc_class):
        exc = exc_class("test") if exc_class is KeyError else exc_class("test error")

        with patch("app.workers.analysis_task._run_analysis", new=AsyncMock(side_effect=exc)):
            mock_retry, raised = _run_task("some-analysis-id")

        assert type(raised) is exc_class
        mock_retry.assert_not_called()

    def test_not_found_error_no_retry(self):
        exc = NotFoundError("Analysis record not found", resource_type="Analysis")

        with patch("app.workers.analysis_task._run_analysis", new=AsyncMock(side_effect=exc)):
            mock_retry, raised = _run_task("missing-id")

        assert isinstance(raised, NotFoundError)
        mock_retry.assert_not_called()

    def test_parsing_error_no_retry(self):
        exc = ParsingError("Resume PDF could not be parsed")

        with patch("app.workers.analysis_task._run_analysis", new=AsyncMock(side_effect=exc)):
            mock_retry, raised = _run_task("some-analysis-id")

        assert isinstance(raised, ParsingError)
        mock_retry.assert_not_called()


class TestRetriableErrors:
    """Transient errors must trigger self.retry() with exponential backoff."""

    def test_connection_error_retries(self):
        exc = ConnectionError("LLM API unreachable")

        with patch("app.workers.analysis_task._run_analysis", new=AsyncMock(side_effect=exc)):
            mock_retry, raised = _run_task("some-analysis-id", retries=0)

        # retry() itself raises (our mock raises "Retry"), so raised should be that
        assert raised is not None
        mock_retry.assert_called_once()
        _, kwargs = mock_retry.call_args
        assert kwargs["exc"] is exc
        assert kwargs["countdown"] == 15  # 15 * 2^0 on first attempt

    def test_os_error_retries(self):
        exc = OSError("Temporary I/O failure")

        with patch("app.workers.analysis_task._run_analysis", new=AsyncMock(side_effect=exc)):
            mock_retry, raised = _run_task("some-analysis-id", retries=0)

        mock_retry.assert_called_once()

    def test_exponential_backoff_on_second_attempt(self):
        """On the second attempt (retries=1), countdown should be 2x the first."""
        exc = ConnectionError("Still unreachable")

        with patch("app.workers.analysis_task._run_analysis", new=AsyncMock(side_effect=exc)):
            mock_retry, _ = _run_task("some-analysis-id", retries=1)

        _, kwargs = mock_retry.call_args
        assert kwargs["countdown"] == 30  # 15 * 2^1


class TestNonRetriableTuple:
    """Sanity-check that NON_RETRIABLE covers expected types."""

    def test_app_exceptions_in_non_retriable(self):
        assert NotFoundError in NON_RETRIABLE
        assert ParsingError in NON_RETRIABLE
        assert ValidationError in NON_RETRIABLE

    def test_builtin_exceptions_in_non_retriable(self):
        assert KeyError in NON_RETRIABLE
        assert ValueError in NON_RETRIABLE
        assert PermissionError in NON_RETRIABLE

    def test_connection_error_not_in_non_retriable(self):
        assert ConnectionError not in NON_RETRIABLE

    def test_os_error_not_in_non_retriable(self):
        assert OSError not in NON_RETRIABLE
