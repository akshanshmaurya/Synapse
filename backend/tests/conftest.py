"""
Pytest Configuration — Synapse Backend Tests
Provides shared fixtures for async API testing.
"""
import os
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch
from app.main import app
from app.core.rate_limiter import rate_limiter


# ---------------------------------------------------------------------------
# Database availability check (at collection time, sync)
# ---------------------------------------------------------------------------

def _mongo_is_reachable() -> bool:
    """Check if MongoDB is reachable."""
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


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def client():
    """Async HTTP test client. Resets rate limiter between tests."""
    rate_limiter._requests.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def unique_email():
    """Generate a unique test email."""
    import uuid
    return f"test_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture
def valid_password():
    """Standard valid password for testing."""
    return "TestPassword123!"


@pytest.fixture
def sample_user_context():
    """Realistic user context for agent tests."""
    return {
        "profile": {
            "interests": ["python", "machine learning"],
            "goals": ["become a data scientist"],
            "stage": "intermediate",
            "learning_pace": "moderate",
        },
        "struggles": [
            {"topic": "recursion", "count": 3, "severity": "moderate"},
        ],
        "progress": {
            "evaluation_history": [
                {"clarity_score": 55, "confusion_trend": "stable", "understanding_delta": 0}
            ],
            "effort_metrics": {"total_sessions": 8, "consistency_streak": 3},
        },
        "context_summary": "An intermediate learner pursuing data science.",
        "recent_interactions": [
            {"user": "How do I learn pandas?", "mentor": "Great question! Start with..."}
        ],
    }


@pytest.fixture
def mock_genai_response():
    """Factory to create a mock genai response with given text."""
    def _make(text: str):
        mock_resp = MagicMock()
        mock_resp.text = text
        return mock_resp
    return _make
