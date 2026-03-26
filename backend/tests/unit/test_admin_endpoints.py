"""
Unit tests for admin endpoints (api/v1/endpoints/admin.py).

Tests admin operations like stale analysis sweeper.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.admin import sweep_stale_analyses_endpoint


class TestAdminEndpoints:
    """Tests for admin endpoints."""

    @pytest.mark.asyncio
    async def test_sweep_stale_analyses_endpoint_success(self):
        """Sweep endpoint successfully runs sweeper."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_user = MagicMock()

        with patch("app.api.v1.endpoints.admin.sweep_stale_analyses") as mock_sweep:
            mock_sweep.return_value = 3  # 3 analyses marked as failed

            result = await sweep_stale_analyses_endpoint(mock_user, mock_session)

            assert result["swept_count"] == 3
            assert "timestamp" in result
            assert "Marked 3 stale analyses as failed" in result["message"]
            mock_sweep.assert_called_once_with(mock_session)

    @pytest.mark.asyncio
    async def test_sweep_stale_analyses_endpoint_error(self):
        """Sweep endpoint handles errors gracefully."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_user = MagicMock()

        from fastapi import HTTPException

        with patch("app.api.v1.endpoints.admin.sweep_stale_analyses") as mock_sweep:
            mock_sweep.side_effect = Exception("Database error")

            with pytest.raises(HTTPException):
                await sweep_stale_analyses_endpoint(mock_user, mock_session)

    @pytest.mark.asyncio
    async def test_sweep_returns_zero_when_nothing_to_sweep(self):
        """Sweep returns 0 when no stale analyses found."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_user = MagicMock()

        with patch("app.api.v1.endpoints.admin.sweep_stale_analyses") as mock_sweep:
            mock_sweep.return_value = 0

            result = await sweep_stale_analyses_endpoint(mock_user, mock_session)

            assert result["swept_count"] == 0
            assert "Marked 0 stale analyses as failed" in result["message"]
