"""
Memory Agent v2 Tests — Three-Layer Context Assembly & Dispatch

Validates the MemoryAgent's facade role:
  - Full three-layer context assembly (Profile + Session + Concepts)
  - Graceful degradation when individual layers fail
  - Context summary format (rule-based, no LLM)
  - Missing session handling

All service calls are mocked — zero network I/O, zero LLM calls.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.agents.memory_agent import MemoryAgent


pytestmark = pytest.mark.asyncio

# Patch targets — services are imported at module level in memory_agent.py
PROFILE_SVC = "app.agents.memory_agent.profile_service"
CONCEPT_SVC = "app.agents.memory_agent.concept_memory_service"
SESSION_SVC = "app.agents.memory_agent.session_context_service"
CHAT_SVC = "app.agents.memory_agent.chat_service"


def _profile_context() -> dict:
    return {
        "experience_level": "intermediate",
        "preferred_learning_style": "visual",
        "mentoring_tone": "balanced",
        "career_interests": ["machine-learning", "python"],
        "strengths_summary": ["problem-solving"],
        "weaknesses_summary": ["time-complexity"],
    }


def _session_summary(goal="Learn recursion", momentum="flowing") -> dict:
    return {
        "session_goal": goal,
        "session_domain": "dsa",
        "session_clarity": 72.0,
        "session_momentum": momentum,
        "active_concepts": ["recursion", "base-case"],
        "session_confusion_points": [],
        "message_count": 6,
    }


def _concept_context() -> dict:
    return {
        "active": {
            "recursion": {"mastery": 0.65, "misconceptions": [], "exposure_count": 4},
            "base-case": {"mastery": 0.45, "misconceptions": ["off-by-one"], "exposure_count": 2},
        },
        "related_weak": [
            {"concept_id": "trees", "concept_name": "Trees", "mastery": 0.2}
        ],
        "overall_mastery_average": 0.55,
    }


# ---------------------------------------------------------------------------
# Full Context Assembly
# ---------------------------------------------------------------------------


class TestRetrieveContext:

    @patch(CHAT_SVC)
    @patch(SESSION_SVC)
    @patch(CONCEPT_SVC)
    @patch(PROFILE_SVC)
    async def test_retrieve_context_assembles_all_layers(
        self, mock_profile, mock_concept, mock_session, mock_chat
    ):
        """All three layers must be present in the assembled context dict.

        WHY: The planner expects profile, session, and concepts keys. If any
        key is missing, the planner's prompt template will raise KeyError,
        crashing the pipeline silently (it's caught by the outer try/except
        and the user gets a fallback response with no useful context).
        """
        mock_profile.get_profile_context_for_agents = AsyncMock(return_value=_profile_context())
        mock_session.get_session_summary = AsyncMock(return_value=_session_summary())
        mock_concept.get_concept_context_for_agents = AsyncMock(return_value=_concept_context())
        mock_chat.get_context_window = AsyncMock(return_value=[
            {"role": "user", "content": "What is recursion?"},
            {"role": "mentor", "content": "Recursion is..."},
        ])

        agent = MemoryAgent()
        ctx = await agent.retrieve_context(
            user_id="user-1", session_id="sess-1", message="Explain base case"
        )

        # All three layers present
        assert "profile" in ctx
        assert "session" in ctx
        assert "concepts" in ctx
        assert "recent_messages" in ctx
        assert "context_summary" in ctx
        assert "_timing" in ctx
        assert "_missing" in ctx

        # Layer content correct
        assert ctx["profile"]["experience_level"] == "intermediate"
        assert ctx["session"]["session_goal"] == "Learn recursion"
        assert ctx["session"]["session_momentum"] == "flowing"
        assert "recursion" in ctx["concepts"]["active"]
        assert len(ctx["recent_messages"]) == 2
        assert ctx["_missing"] == []

    @patch(CHAT_SVC)
    @patch(SESSION_SVC)
    @patch(CONCEPT_SVC)
    @patch(PROFILE_SVC)
    async def test_retrieve_context_handles_service_failure(
        self, mock_profile, mock_concept, mock_session, mock_chat
    ):
        """If one layer fails, partial context is returned with _missing indicator.

        WHY: In production, MongoDB might be slow or a service might throw.
        The pipeline must degrade gracefully — returning an empty profile with
        valid session data is far better than crashing the entire request.
        The _missing list lets the planner know which data is unavailable.
        """
        mock_profile.get_profile_context_for_agents = AsyncMock(
            side_effect=Exception("MongoDB timeout")
        )
        mock_session.get_session_summary = AsyncMock(return_value=_session_summary())
        mock_concept.get_concept_context_for_agents = AsyncMock(return_value=_concept_context())
        mock_chat.get_context_window = AsyncMock(return_value=[])

        agent = MemoryAgent()
        ctx = await agent.retrieve_context(
            user_id="user-1", session_id="sess-1", message="hello"
        )

        # Profile failed — should be empty dict, not crash
        assert ctx["profile"] == {}
        assert "profile" in ctx["_missing"]
        # Other layers should still work
        assert ctx["session"]["session_goal"] == "Learn recursion"
        assert "recursion" in ctx["concepts"]["active"]

    @patch(CHAT_SVC)
    @patch(SESSION_SVC)
    @patch(CONCEPT_SVC)
    @patch(PROFILE_SVC)
    async def test_retrieve_context_handles_missing_session(
        self, mock_profile, mock_concept, mock_session, mock_chat
    ):
        """Missing session returns cold-start defaults in the session key.

        WHY: On the very first message of a brand-new chat, the session might
        not exist yet. The MemoryAgent must still return a valid context with
        sensible defaults so the planner can function.
        """
        mock_profile.get_profile_context_for_agents = AsyncMock(return_value=_profile_context())
        mock_session.get_session_summary = AsyncMock(return_value={
            "session_goal": None, "session_domain": None, "session_clarity": 50.0,
            "session_momentum": "cold_start", "active_concepts": [],
            "session_confusion_points": [], "message_count": 0,
        })
        mock_concept.get_concept_context_for_agents = AsyncMock(return_value={
            "active": {}, "related_weak": [], "overall_mastery_average": 0.0,
        })
        mock_chat.get_context_window = AsyncMock(return_value=[])

        agent = MemoryAgent()
        ctx = await agent.retrieve_context(
            user_id="user-1", session_id="new-sess", message="hello"
        )

        assert ctx["session"]["session_clarity"] == 50.0
        assert ctx["session"]["session_momentum"] == "cold_start"
        assert ctx["concepts"]["active"] == {}


# ---------------------------------------------------------------------------
# Context Summary
# ---------------------------------------------------------------------------


class TestContextSummary:

    def test_context_summary_format(self):
        """Context summary must be a well-formed natural language string.

        WHY: This summary is injected directly into LLM prompts. If it
        contains None, empty strings, or broken formatting, the LLM will
        produce lower quality responses because its context is noisy.
        """
        summary = MemoryAgent._build_context_summary(
            profile=_profile_context(),
            session=_session_summary(),
            concepts=_concept_context(),
        )

        assert isinstance(summary, str)
        assert len(summary) > 50
        assert "intermediate" in summary
        assert "Learn recursion" in summary
        assert "flowing" in summary
        assert "recursion" in summary
        assert "None" not in summary  # No literal None in the output

    def test_summary_with_empty_data(self):
        """Summary with no data should still produce a valid string.

        WHY: On the first message with no profile/session, the summary
        must be safe to inject into the prompt without crashing.
        """
        summary = MemoryAgent._build_context_summary(
            profile={}, session={}, concepts={},
        )

        assert isinstance(summary, str)
        assert len(summary) > 20
        assert "beginner" in summary  # default from .get()


# ---------------------------------------------------------------------------
# Memory Update Dispatch
# ---------------------------------------------------------------------------


class TestUpdateMemory:

    @patch(SESSION_SVC)
    @patch(CONCEPT_SVC)
    @patch(PROFILE_SVC)
    async def test_update_memory_dispatches_to_session(
        self, mock_profile, mock_concept, mock_session
    ):
        """update_memory must call session_context_service.update_clarity.

        WHY: Session clarity is the primary evaluator output. If it doesn't
        get written, the session's momentum will never change from cold_start,
        meaning the planner will treat every conversation as brand new.
        """
        mock_session.update_clarity = AsyncMock()
        mock_session.increment_message_count = AsyncMock()
        mock_concept.update_concept = AsyncMock()
        mock_profile.update_strengths_weaknesses = AsyncMock()

        agent = MemoryAgent()
        await agent.update_memory(
            user_id="user-1",
            session_id="sess-1",
            evaluation_result={
                "clarity_score": 72.0,
                "confusion_points": ["base case"],
                "concepts_discussed": [],
            },
        )

        mock_session.update_clarity.assert_called_once()
        call_args = mock_session.update_clarity.call_args
        assert call_args[0][0] == "sess-1"  # session_id
        assert call_args[0][1] == 72.0  # clarity_score

    @patch(SESSION_SVC)
    @patch(CONCEPT_SVC)
    @patch(PROFILE_SVC)
    async def test_update_memory_session_failure_doesnt_crash(
        self, mock_profile, mock_concept, mock_session
    ):
        """If session update fails, concept/profile updates should still run.

        WHY: The background task pipeline processes all three layers
        independently. A MongoDB hiccup on session writes must not prevent
        concept mastery updates from being recorded.
        """
        mock_session.update_clarity = AsyncMock(side_effect=Exception("DB error"))
        mock_session.increment_message_count = AsyncMock()
        mock_concept.update_concept = AsyncMock()
        mock_profile.update_strengths_weaknesses = AsyncMock()

        agent = MemoryAgent()

        # Should not raise — errors are caught internally
        await agent.update_memory(
            user_id="user-1",
            session_id="sess-1",
            evaluation_result={"clarity_score": 50.0},
        )
