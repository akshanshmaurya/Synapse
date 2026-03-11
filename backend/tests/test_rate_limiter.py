"""
Rate Limiter Tests — Synapse Backend
Unit tests for the custom sliding window rate limiter.
"""
import pytest
import time
from unittest.mock import patch
from app.core.rate_limiter import RateLimiter


class TestRateLimiter:
    def setup_method(self):
        """Fresh limiter for each test."""
        self.limiter = RateLimiter()

    def test_allows_within_limit(self):
        """Requests within the limit are allowed."""
        for _ in range(5):
            assert self.limiter.check("test_key", max_requests=5, window_seconds=60) is True

    def test_blocks_over_limit(self):
        """Request exceeding the limit is blocked."""
        for _ in range(5):
            self.limiter.check("test_key", max_requests=5, window_seconds=60)

        assert self.limiter.check("test_key", max_requests=5, window_seconds=60) is False

    def test_different_keys_are_independent(self):
        """Rate limits are per-key."""
        for _ in range(5):
            self.limiter.check("key_a", max_requests=5, window_seconds=60)

        # key_b should still be allowed
        assert self.limiter.check("key_b", max_requests=5, window_seconds=60) is True

    def test_window_expiration(self):
        """Old entries are cleaned after the window expires."""
        for _ in range(5):
            self.limiter.check("test_key", max_requests=5, window_seconds=1)

        # Simulate time passing
        with patch("app.core.rate_limiter.time") as mock_time:
            mock_time.time.return_value = time.time() + 2
            assert self.limiter.check("test_key", max_requests=5, window_seconds=1) is True

    def test_remaining_count(self):
        """remaining() returns correct count."""
        self.limiter.check("test_key", max_requests=5, window_seconds=60)
        self.limiter.check("test_key", max_requests=5, window_seconds=60)
        remaining = self.limiter.remaining("test_key", max_requests=5, window_seconds=60)
        assert remaining == 3
