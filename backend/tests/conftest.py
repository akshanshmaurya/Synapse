"""
Pytest Configuration — Synapse Backend Tests
Provides shared fixtures for async API testing.
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def client():
    """Async HTTP test client using httpx + ASGI transport."""
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
