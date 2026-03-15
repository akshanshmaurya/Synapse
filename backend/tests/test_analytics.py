"""
Analytics Logic Tests — Phase 4
Tests for learning analytics aggregation logic.
"""
import pytest
from unittest.mock import patch, AsyncMock
from datetime import datetime, timedelta


pytestmark = pytest.mark.asyncio


class TestAnalyticsLogic:
    """Test analytics aggregation logic directly."""

    async def test_empty_analytics_structure(self):
        """Empty analytics returns valid structure."""
        from app.routes.analytics import _empty_analytics
        result = _empty_analytics()

        assert result["clarity_trend"] == []
        assert result["confusion_trend"] == []
        assert result["session_activity"] == []
        assert result["struggles"] == []
        assert result["summary"]["current_clarity"] == 50
        assert result["summary"]["current_trend"] == "stable"
        assert result["summary"]["learning_pace"] == "moderate"
        assert result["summary"]["stage"] == "seedling"
        assert result["summary"]["total_sessions"] == 0
        assert result["summary"]["total_evaluations"] == 0
        assert result["summary"]["roadmap_regenerations"] == 0

    async def test_session_activity_computation(self):
        """Session activity computes daily counts over 30 days."""
        from app.routes.analytics import _compute_session_activity

        today = datetime.utcnow().date().isoformat()
        interactions = [
            {"timestamp": today},
            {"timestamp": today},
            {"timestamp": today},
        ]

        result = _compute_session_activity(interactions)
        assert len(result) == 30
        # Today should have 3 sessions
        assert result[-1]["sessions"] == 3
        assert result[-1]["date"] == today
        # Other days should be 0
        assert result[0]["sessions"] == 0

    async def test_session_activity_empty(self):
        """Empty interactions returns 30 days of zeros."""
        from app.routes.analytics import _compute_session_activity

        result = _compute_session_activity([])
        assert len(result) == 30
        assert all(d["sessions"] == 0 for d in result)

    async def test_session_activity_multiple_days(self):
        """Sessions across multiple days are correctly bucketed."""
        from app.routes.analytics import _compute_session_activity

        today = datetime.utcnow().date()
        yesterday = (today - timedelta(days=1)).isoformat()
        today_str = today.isoformat()

        interactions = [
            {"timestamp": yesterday},
            {"timestamp": yesterday},
            {"timestamp": today_str},
        ]

        result = _compute_session_activity(interactions)
        # Yesterday should have 2, today should have 1
        assert result[-1]["sessions"] == 1
        assert result[-2]["sessions"] == 2

    @patch("app.routes.analytics.get_user_memory_collection")
    async def test_analytics_with_no_memory(self, mock_collection):
        """No user memory returns empty analytics."""
        from app.routes.analytics import get_learning_analytics

        mock_coll = AsyncMock()
        mock_coll.find_one = AsyncMock(return_value=None)
        mock_collection.return_value = mock_coll

        result = await get_learning_analytics(user_id="user123")
        assert result["clarity_trend"] == []
        assert result["summary"]["total_sessions"] == 0

    @patch("app.routes.analytics.get_user_memory_collection")
    async def test_analytics_with_evaluation_history(self, mock_collection):
        """Evaluation history is transformed into clarity trends."""
        from app.routes.analytics import get_learning_analytics

        mock_coll = AsyncMock()
        mock_coll.find_one = AsyncMock(return_value={
            "user_id": "user123",
            "progress": {
                "evaluation_history": [
                    {"clarity_score": 40, "confusion_trend": "worsening", "timestamp": "2026-03-10"},
                    {"clarity_score": 60, "confusion_trend": "stable", "timestamp": "2026-03-11"},
                    {"clarity_score": 75, "confusion_trend": "improving", "timestamp": "2026-03-12"},
                ],
                "roadmap_regeneration_count": 2,
            },
            "interactions": [
                {"timestamp": "2026-03-10"},
                {"timestamp": "2026-03-11"},
                {"timestamp": "2026-03-12"},
            ],
            "struggles": [
                {"topic": "recursion", "severity": "moderate", "occurrence_count": 3},
            ],
            "profile": {
                "learning_pace": "slow",
                "stage": "growing",
            },
        })
        mock_collection.return_value = mock_coll

        result = await get_learning_analytics(user_id="user123")

        # Clarity trend
        assert len(result["clarity_trend"]) == 3
        assert result["clarity_trend"][0]["score"] == 40
        assert result["clarity_trend"][2]["score"] == 75

        # Summary
        assert result["summary"]["current_clarity"] == 75
        assert result["summary"]["current_trend"] == "improving"
        assert result["summary"]["learning_pace"] == "slow"
        assert result["summary"]["total_evaluations"] == 3
        assert result["summary"]["roadmap_regenerations"] == 2

        # Struggles
        assert len(result["struggles"]) == 1
        assert result["struggles"][0]["topic"] == "recursion"
        assert result["struggles"][0]["count"] == 3

    @patch("app.routes.analytics.get_user_memory_collection")
    async def test_analytics_handles_missing_fields(self, mock_collection):
        """Analytics gracefully handles missing nested fields."""
        from app.routes.analytics import get_learning_analytics

        mock_coll = AsyncMock()
        mock_coll.find_one = AsyncMock(return_value={
            "user_id": "user123",
            # No progress, interactions, struggles, or profile
        })
        mock_collection.return_value = mock_coll

        result = await get_learning_analytics(user_id="user123")
        assert result["clarity_trend"] == []
        assert result["struggles"] == []
        assert result["summary"]["current_clarity"] == 50

    @patch("app.routes.analytics.get_user_memory_collection")
    async def test_analytics_caps_at_30_evaluations(self, mock_collection):
        """Only the last 30 evaluations are included in trends."""
        from app.routes.analytics import get_learning_analytics

        mock_coll = AsyncMock()
        eval_history = [
            {"clarity_score": i, "confusion_trend": "stable", "timestamp": f"2026-03-{i:02d}"}
            for i in range(1, 50)
        ]
        mock_coll.find_one = AsyncMock(return_value={
            "user_id": "user123",
            "progress": {"evaluation_history": eval_history},
            "interactions": [],
            "struggles": [],
            "profile": {},
        })
        mock_collection.return_value = mock_coll

        result = await get_learning_analytics(user_id="user123")
        assert len(result["clarity_trend"]) == 30
