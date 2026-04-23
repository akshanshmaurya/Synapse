"""
Rate Limiter
Lightweight in-memory rate limiter using sliding window counters.
Compatible with Python 3.14+ (no pkg_resources dependency).

SCALABILITY NOTE: 
This current implementation is in-memory and per-process. 
In a scaled deployment with multiple Uvicorn workers or distributed pods, 
this should be replaced with a Redis-backed store (e.g., using `redis-py` 
or a dedicated library like `limits`) to ensure global rate-limit enforcement.
The `rate_limit` dependency API can remain unchanged while swapping the backend.
"""
import time
from collections import defaultdict
from typing import Optional
from fastapi import HTTPException, Request, status
from app.utils.logger import logger


class RateLimiter:
    """
    In-memory sliding window rate limiter.
    Tracks request counts per IP within a configurable time window.
    """

    def __init__(self):
        # { "key": [(timestamp, ...)] }
        """Internal helper."""
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _clean_old_entries(self, key: str, window_seconds: int):
        """Remove entries older than the window."""
        cutoff = time.time() - window_seconds
        self._requests[key] = [
            t for t in self._requests[key] if t > cutoff
        ]

    def check(self, key: str, max_requests: int, window_seconds: int) -> bool:
        """
        Check if a request is allowed.
        Returns True if allowed, False if rate limited.
        """
        self._clean_old_entries(key, window_seconds)

        if len(self._requests[key]) >= max_requests:
            return False

        self._requests[key].append(time.time())
        return True

    def remaining(self, key: str, max_requests: int, window_seconds: int) -> int:
        """Get the number of remaining requests in the current window."""
        self._clean_old_entries(key, window_seconds)
        return max(0, max_requests - len(self._requests[key]))


# Singleton
rate_limiter = RateLimiter()


def get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(max_requests: int, window_seconds: int = 60, prefix: str = ""):
    """
    Rate limit dependency factory.

    Usage:
        @app.post("/api/auth/login")
        async def login(request: Request, _=Depends(rate_limit(5, 60, "login"))):
            ...
    """
    async def _rate_limit_check(request: Request):
        """Internal helper."""
        ip = get_client_ip(request)
        key = f"{prefix}:{ip}" if prefix else ip

        if not rate_limiter.check(key, max_requests, window_seconds):
            remaining = rate_limiter.remaining(key, max_requests, window_seconds)
            logger.warning(
                "Rate limit exceeded: %s (%d/%d per %ds)",
                key, max_requests, max_requests, window_seconds,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Try again in {window_seconds} seconds.",
            )

    return _rate_limit_check
