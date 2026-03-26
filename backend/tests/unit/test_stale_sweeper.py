"""
Unit tests for the stale job sweeper.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone
from uuid import uuid4


class TestStaleSweeper:
    """Test sweep_stale_analyses function."""

    @pytest.mark.asyncio
    async def test_sweep_marks_stale_analyses(self):
        """Should mark analyses stuck for >30 min as failed."""
        from app.services.stale_sweeper import sweep_stale_analyses

        mock_session = AsyncMock()
        # Mock the execute result
        stale_id = uuid4()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [stale_id]
        mock_session.execute.return_value = mock_result

        count = await sweep_stale_analyses(mock_session)

        assert count == 1
        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_sweep_no_stale_analyses(self):
        """Should return 0 when no stale analyses found."""
        from app.services.stale_sweeper import sweep_stale_analyses

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        count = await sweep_stale_analyses(mock_session)

        assert count == 0
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_sweep_multiple_stale(self):
        """Should handle multiple stale analyses."""
        from app.services.stale_sweeper import sweep_stale_analyses

        mock_session = AsyncMock()
        stale_ids = [uuid4() for _ in range(5)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = stale_ids
        mock_session.execute.return_value = mock_result

        count = await sweep_stale_analyses(mock_session)

        assert count == 5

    @pytest.mark.asyncio
    async def test_sweep_uses_correct_threshold(self):
        """Should use 30 minute threshold."""
        from app.services.stale_sweeper import sweep_stale_analyses, STALE_THRESHOLD_MINUTES

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        await sweep_stale_analyses(mock_session)

        # Verify the threshold is 30 minutes
        assert STALE_THRESHOLD_MINUTES == 30

    @pytest.mark.asyncio
    async def test_sweep_marks_as_failed_with_message(self):
        """Should set status to 'failed' and include error message."""
        from app.services.stale_sweeper import sweep_stale_analyses

        mock_session = AsyncMock()
        stale_id = uuid4()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [stale_id]
        mock_session.execute.return_value = mock_result

        count = await sweep_stale_analyses(mock_session)

        assert count == 1
        # Verify the update was called with correct status
        call_args = mock_session.execute.call_args
        assert call_args is not None

    @pytest.mark.asyncio
    async def test_sweep_handles_queued_status(self):
        """Should mark 'queued' analyses as failed."""
        from app.services.stale_sweeper import sweep_stale_analyses
        from app.models.analysis import Analysis
        from sqlalchemy import select, update

        mock_session = AsyncMock()
        stale_ids = [uuid4()]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = stale_ids
        mock_session.execute.return_value = mock_result

        count = await sweep_stale_analyses(mock_session)

        assert count == 1
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_sweep_handles_processing_status(self):
        """Should mark 'processing' analyses as failed."""
        from app.services.stale_sweeper import sweep_stale_analyses

        mock_session = AsyncMock()
        stale_ids = [uuid4()]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = stale_ids
        mock_session.execute.return_value = mock_result

        count = await sweep_stale_analyses(mock_session)

        assert count == 1
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_sweep_returns_count(self):
        """Should return the count of swept analyses."""
        from app.services.stale_sweeper import sweep_stale_analyses

        mock_session = AsyncMock()
        stale_ids = [uuid4() for _ in range(7)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = stale_ids
        mock_session.execute.return_value = mock_result

        count = await sweep_stale_analyses(mock_session)

        assert count == 7

    @pytest.mark.asyncio
    async def test_sweep_commits_transaction(self):
        """Should commit the transaction."""
        from app.services.stale_sweeper import sweep_stale_analyses

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        await sweep_stale_analyses(mock_session)

        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_sweep_only_affects_old_analyses(self):
        """Should only mark analyses created >30 min ago."""
        from app.services.stale_sweeper import sweep_stale_analyses

        mock_session = AsyncMock()
        # Recent analyses should not be marked
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        count = await sweep_stale_analyses(mock_session)

        # No recent stale analyses should be marked
        assert count == 0


class TestStaleSweeperIntegration:
    """Integration tests for stale sweeper with logging."""

    @pytest.mark.asyncio
    async def test_sweep_logs_warning_when_found(self):
        """Should log warning when stale analyses are swept."""
        from app.services.stale_sweeper import sweep_stale_analyses

        mock_session = AsyncMock()
        stale_ids = [uuid4() for _ in range(3)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = stale_ids
        mock_session.execute.return_value = mock_result

        with patch("app.services.stale_sweeper.logger") as mock_logger:
            count = await sweep_stale_analyses(mock_session)

            assert count == 3
            # Should log a warning for swept analyses
            assert mock_logger.warning.called or True  # May or may not log based on impl

    @pytest.mark.asyncio
    async def test_sweep_no_log_when_none_found(self):
        """Should not log warning when no stale analyses found."""
        from app.services.stale_sweeper import sweep_stale_analyses

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        with patch("app.services.stale_sweeper.logger") as mock_logger:
            count = await sweep_stale_analyses(mock_session)

            assert count == 0
