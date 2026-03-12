"""
Evaluator Memory Interaction Tests — Phase 3
Verifies that evaluator results correctly flow into Memory Agent.
All database calls are mocked.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.evaluator_agent import EvaluatorAgent


pytestmark = pytest.mark.asyncio


# MemoryAgent is imported LOCALLY inside update_memory_from_evaluation:
#   from app.agents.memory_agent import MemoryAgent
# So we must patch at the SOURCE module, not on evaluator_agent.
MEMORY_AGENT_PATH = "app.agents.memory_agent.MemoryAgent"


# ---------------------------------------------------------------------------
# Step 7: Memory Interaction Tests
# ---------------------------------------------------------------------------


class TestEvaluatorToMemory:
    """Test that update_memory_from_evaluation routes data to MemoryAgent correctly."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()

    @patch(MEMORY_AGENT_PATH)
    async def test_struggle_stored(self, MockMemory):
        """Detected struggle is forwarded to MemoryAgent.update_struggle."""
        mock_mem = MockMemory.return_value
        mock_mem.update_struggle = AsyncMock()
        mock_mem.update_profile = AsyncMock()
        mock_mem.get_user_context = AsyncMock(return_value={"profile": {"interests": []}})

        evaluation = {
            "struggle_detected": "recursion",
            "struggle_severity": "moderate",
            "pace_adjustment": None,
            "new_interest_detected": None,
            "stage_change_recommended": None,
        }
        await self.evaluator.update_memory_from_evaluation("user123", evaluation)

        mock_mem.update_struggle.assert_called_once_with("user123", "recursion", "moderate")

    @patch(MEMORY_AGENT_PATH)
    async def test_no_struggle_no_call(self, MockMemory):
        """No struggle detected → update_struggle NOT called."""
        mock_mem = MockMemory.return_value
        mock_mem.update_struggle = AsyncMock()
        mock_mem.update_profile = AsyncMock()

        evaluation = {
            "struggle_detected": None,
            "struggle_severity": None,
            "pace_adjustment": None,
            "new_interest_detected": None,
            "stage_change_recommended": None,
        }
        await self.evaluator.update_memory_from_evaluation("user123", evaluation)

        mock_mem.update_struggle.assert_not_called()

    @patch(MEMORY_AGENT_PATH)
    async def test_pace_slow_down(self, MockMemory):
        """pace_adjustment='slow_down' → update_profile(learning_pace='slow')."""
        mock_mem = MockMemory.return_value
        mock_mem.update_struggle = AsyncMock()
        mock_mem.update_profile = AsyncMock()

        evaluation = {
            "struggle_detected": None,
            "pace_adjustment": "slow_down",
            "new_interest_detected": None,
            "stage_change_recommended": None,
        }
        await self.evaluator.update_memory_from_evaluation("user123", evaluation)

        mock_mem.update_profile.assert_called_once_with("user123", learning_pace="slow")

    @patch(MEMORY_AGENT_PATH)
    async def test_pace_speed_up(self, MockMemory):
        """pace_adjustment='speed_up' → update_profile(learning_pace='fast')."""
        mock_mem = MockMemory.return_value
        mock_mem.update_struggle = AsyncMock()
        mock_mem.update_profile = AsyncMock()

        evaluation = {
            "struggle_detected": None,
            "pace_adjustment": "speed_up",
            "new_interest_detected": None,
            "stage_change_recommended": None,
        }
        await self.evaluator.update_memory_from_evaluation("user123", evaluation)

        mock_mem.update_profile.assert_called_once_with("user123", learning_pace="fast")

    @patch(MEMORY_AGENT_PATH)
    async def test_pace_maintain_no_call(self, MockMemory):
        """pace_adjustment='maintain' → no profile update (maps to None)."""
        mock_mem = MockMemory.return_value
        mock_mem.update_struggle = AsyncMock()
        mock_mem.update_profile = AsyncMock()

        evaluation = {
            "struggle_detected": None,
            "pace_adjustment": "maintain",
            "new_interest_detected": None,
            "stage_change_recommended": None,
        }
        await self.evaluator.update_memory_from_evaluation("user123", evaluation)

        mock_mem.update_profile.assert_not_called()

    @patch(MEMORY_AGENT_PATH)
    async def test_new_interest_added(self, MockMemory):
        """New interest → appended to existing interests via update_profile."""
        mock_mem = MockMemory.return_value
        mock_mem.update_struggle = AsyncMock()
        mock_mem.update_profile = AsyncMock()
        mock_mem.get_user_context = AsyncMock(return_value={
            "profile": {"interests": ["python", "data science"]},
        })

        evaluation = {
            "struggle_detected": None,
            "pace_adjustment": None,
            "new_interest_detected": "machine learning",
            "stage_change_recommended": None,
        }
        await self.evaluator.update_memory_from_evaluation("user123", evaluation)

        mock_mem.update_profile.assert_called_once()
        call_args = mock_mem.update_profile.call_args
        assert "machine learning" in call_args.kwargs.get("interests", [])

    @patch(MEMORY_AGENT_PATH)
    async def test_duplicate_interest_not_added(self, MockMemory):
        """Duplicate interest → not added again."""
        mock_mem = MockMemory.return_value
        mock_mem.update_struggle = AsyncMock()
        mock_mem.update_profile = AsyncMock()
        mock_mem.get_user_context = AsyncMock(return_value={
            "profile": {"interests": ["python", "machine learning"]},
        })

        evaluation = {
            "struggle_detected": None,
            "pace_adjustment": None,
            "new_interest_detected": "machine learning",  # already exists
            "stage_change_recommended": None,
        }
        await self.evaluator.update_memory_from_evaluation("user123", evaluation)

        mock_mem.update_profile.assert_not_called()

    @patch(MEMORY_AGENT_PATH)
    async def test_stage_change(self, MockMemory):
        """Stage change recommendation → update_profile with new stage."""
        mock_mem = MockMemory.return_value
        mock_mem.update_struggle = AsyncMock()
        mock_mem.update_profile = AsyncMock()

        evaluation = {
            "struggle_detected": None,
            "pace_adjustment": None,
            "new_interest_detected": None,
            "stage_change_recommended": "flourishing",
        }
        await self.evaluator.update_memory_from_evaluation("user123", evaluation)

        mock_mem.update_profile.assert_called_once_with("user123", stage="flourishing")

    @patch(MEMORY_AGENT_PATH)
    async def test_full_evaluation_all_updates(self, MockMemory):
        """Full evaluation with all fields triggers all memory updates."""
        mock_mem = MockMemory.return_value
        mock_mem.update_struggle = AsyncMock()
        mock_mem.update_profile = AsyncMock()
        mock_mem.get_user_context = AsyncMock(return_value={
            "profile": {"interests": ["math"]},
        })

        evaluation = {
            "struggle_detected": "calculus",
            "struggle_severity": "significant",
            "pace_adjustment": "slow_down",
            "new_interest_detected": "physics",
            "stage_change_recommended": "growing",
        }
        await self.evaluator.update_memory_from_evaluation("user123", evaluation)

        # All three paths should have been called
        mock_mem.update_struggle.assert_called_once()
        assert mock_mem.update_profile.call_count >= 2


# ---------------------------------------------------------------------------
# Step 7: Roadmap Feedback Memory Tests
# ---------------------------------------------------------------------------


class TestRoadmapFeedbackToMemory:
    """Test update_memory_from_roadmap_feedback."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()

    @patch("app.db.mongodb.get_user_memory_collection")
    @patch(MEMORY_AGENT_PATH)
    async def test_feedback_updates_pace_and_counter(self, MockMemory, MockCollection):
        """Roadmap feedback updates pace and increments regeneration counter."""
        mock_mem = MockMemory.return_value
        mock_mem.update_struggle = AsyncMock()

        mock_collection = MagicMock()
        mock_collection.update_one = AsyncMock()
        MockCollection.return_value = mock_collection

        analysis = {
            "new_learning_pace": "slow",
            "difficulty_areas": ["data structures", "algorithms"],
        }

        await self.evaluator.update_memory_from_roadmap_feedback("user123", analysis)

        # Should call update_one for pace + regeneration count
        mock_collection.update_one.assert_called_once()
        # Should call update_struggle for each difficulty area
        assert mock_mem.update_struggle.call_count == 2
