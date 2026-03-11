"""
Pytest Configuration — Synapse Backend Tests
Provides shared fixtures for async API testing.
"""
import os
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.rate_limiter import rate_limiter


def _mongo_is_reachable() -> bool:
    """Check if MongoDB is reachable (sync check at collection time)."""
    try:
        from pymongo import MongoClient
        uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        client = MongoClient(uri, serverSelectionTimeoutMS=2000)
        client.admin.command("ping")
        client.close()
        return True
    except Exception:
        return False


_DB_AVAILABLE = _mongo_is_reachable()


def pytest_collection_modifyitems(config, items):
    """Auto-skip tests marked with @pytest.mark.requires_db when DB is down."""
    if _DB_AVAILABLE:
        return
    skip_marker = pytest.mark.skip(reason="MongoDB not reachable")
    for item in items:
        if "requires_db" in item.keywords:
            item.add_marker(skip_marker)


@pytest.fixture
async def client():
    """Async HTTP test client using httpx + ASGI transport.
    Resets the in-memory rate limiter between tests to prevent 429 interference."""
    rate_limiter._requests.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def unique_email():
    """Generate a unique test email for each test."""
    import uuid
    return f"test_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture
def valid_password():
    """Standard valid password for testing."""
    return "TestPassword123!"
