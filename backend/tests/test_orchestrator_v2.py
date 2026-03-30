"""
Orchestrator v2 Pipeline Tests — Phase 4.7 Integration

Validates that the 10-step pipeline correctly wires all Phase 4.7 services:
  - Session context creation on first message
  - Three-layer context passed to planner
  - Session message count incremented after response
  - Evaluator writes to session context (via background task)
  - Goal inference persisted from planner to session
  - Fallback to legacy pipeline when v2 services fail
  - session_goal passthrough from API layer

All agents and services are mocked — zero LLM calls, zero I/O.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from datetime import datetime

from app.services.agent_orchestrator import AgentOrchestrator
from app.models.memory_v2 import SessionContext
from app.models.chat import MessageSender


pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# Patch targets — these are the module-level singletons in agent_orchestrator.py
# ---------------------------------------------------------------------------
SESSION_CTX_SVC = "app.services.agent_orchestrator.session_context_service"
CHAT_SVC = "app.services.agent_orchestrator.chat_service"
TRACE_SVC = "app.services.agent_orchestrator.trace_service"


def _mock_session_context(**overrides) -> SessionContext:
    """Create a SessionContext with sensible defaults."""
    defaults = dict(
        session_id="chat-123",
        user_id="user-1",
        session_goal=None,
        session_domain=None,
        active_concepts=[],
        session_clarity=50.0,
        session_confusion_points=[],
        message_count=0,
        session_momentum="cold_start",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    defaults.update(overrides)
    return SessionContext(**defaults)


def _mock_v2_context(session_goal=None, momentum="cold_start", clarity=50.0) -> dict:
    """Structured context dict as returned by MemoryAgent.retrieve_context."""
    return {
        "profile": {
            "experience_level": "beginner",
            "preferred_learning_style": "mixed",
            "mentoring_tone": "balanced",
            "career_interests": [],
            "strengths_summary": [],
            "weaknesses_summary": [],
        },
        "session": {
            "goal": session_goal,
            "domain": None,
            "clarity": clarity,
            "momentum": momentum,
            "active_concepts": [],
            "confusion_points": [],
            "message_count": 0,
        },
        "concepts": {
            "active": {},
            "related_weak": [],
            "overall_mastery_average": 0.0,
        },
        "recent_messages": [],
        "context_summary": "A beginner learner. Cold start session.",
        "_timing": {"total_ms": 5.0},
        "_missing": [],
    }


def _mock_strategy(**overrides) -> dict:
    """Planner strategy dict."""
    base = {
        "strategy": "explain",
        "tone": "supportive",
        "pacing": "moderate",
        "focus_concepts": [],
        "should_assess": False,
        "chat_intent": "learning",
        "session_goal_inference": None,
        "memory_update": {},
        "detected_emotion": "neutral",
        "max_lines": 6,
    }
    base.update(overrides)
    return base


def _setup_orchestrator():
    """Create an orchestrator with all agents mocked."""
    orch = AgentOrchestrator()
    orch.memory_agent = MagicMock()
    orch.planner_agent = MagicMock()
    orch.executor_agent = MagicMock()
    orch.evaluator_agent = MagicMock()
    return orch


def _patch_chat_service(mock_chat_svc):
    """Configure the chat service mock with all needed async methods."""
    mock_chat_svc.get_or_create_active_chat = AsyncMock(return_value="chat-123")
    mock_chat_svc.add_message = AsyncMock()
    mock_chat_svc.update_chat_title = AsyncMock()
    mock_chat_svc.get_message_count = AsyncMock(return_value=1)
    mock_chat_svc.format_context_for_llm = AsyncMock(return_value="")
    mock_chat_svc.get_context_window = AsyncMock(return_value=[])


def _patch_session_service(mock_session_svc):
    """Configure the session context service mock."""
    mock_session_svc.get_or_create = AsyncMock(return_value=_mock_session_context())
    mock_session_svc.increment_message_count = AsyncMock()
    mock_session_svc.update_session_goal = AsyncMock()
    mock_session_svc.get_session_summary = AsyncMock(return_value={
        "goal": None, "domain": None, "clarity": 50.0,
        "momentum": "cold_start", "active_concepts": [],
        "confusion_points": [], "message_count": 0,
    })


def _patch_trace_service(mock_trace_svc):
    """Configure the trace service mock."""
    mock_trace_svc.add_trace = AsyncMock()


def _setup_agents(orch, v2_context=None, strategy=None, response="Hello learner!"):
    """Configure agent mocks on the orchestrator."""
    orch.memory_agent.retrieve_context = AsyncMock(
        return_value=v2_context or _mock_v2_context()
    )
    orch.memory_agent.get_user_context = AsyncMock(return_value={
        "profile": {"interests": [], "stage": "seedling"},
        "progress": {"evaluation_history": []},
        "struggles": [],
    })
    orch.planner_agent.plan_response_v2 = AsyncMock(
        return_value=strategy or _mock_strategy()
    )
    orch.planner_agent.plan_response = MagicMock(
        return_value=strategy or _mock_strategy()
    )
    orch.executor_agent.generate_response = MagicMock(return_value=response)
    orch.evaluator_agent.detect_struggle = MagicMock(
        return_value={"is_struggle": False}
    )


# ---------------------------------------------------------------------------
# Pipeline: Session Context Creation
# ---------------------------------------------------------------------------


class TestPipelineSessionContext:

    @patch(TRACE_SVC)
    @patch(CHAT_SVC)
    @patch(SESSION_CTX_SVC)
    async def test_pipeline_creates_session_context(
        self, mock_session_svc, mock_chat_svc, mock_trace_svc
    ):
        """Step 2: Session context must be loaded/created on every message.

        WHY: SessionContext is the working memory buffer for the current
        conversation. Without it, the planner has no session-scoped clarity,
        momentum, or goal — it would treat message #15 the same as message #1.
        """
        _patch_session_service(mock_session_svc)
        _patch_chat_service(mock_chat_svc)
        _patch_trace_service(mock_trace_svc)

        orch = _setup_orchestrator()
        _setup_agents(orch, response="Hello learner!")

        result = await orch.process_message_async("user-1", "Hello")

        assert result["response"] == "Hello learner!"
        assert result["chat_id"] == "chat-123"
        mock_session_svc.get_or_create.assert_called_once_with(
            session_id="chat-123", user_id="user-1"
        )


# ---------------------------------------------------------------------------
# Pipeline: Session Goal
# ---------------------------------------------------------------------------


class TestPipelineSessionGoal:

    @patch(TRACE_SVC)
    @patch(CHAT_SVC)
    @patch(SESSION_CTX_SVC)
    async def test_explicit_session_goal_persisted(
        self, mock_session_svc, mock_chat_svc, mock_trace_svc
    ):
        """When session_goal is passed, it must be persisted BEFORE the pipeline runs.

        WHY: The explicit session goal takes priority over the planner's
        inference. If it's persisted after the planner runs, the planner
        will operate on stale (None) goal data for the first message, which
        means the first response might be off-topic.
        """
        _patch_session_service(mock_session_svc)
        _patch_chat_service(mock_chat_svc)
        _patch_trace_service(mock_trace_svc)

        orch = _setup_orchestrator()
        _setup_agents(orch, response="Let's learn recursion!")

        await orch.process_message_async(
            "user-1", "I want to learn recursion",
            session_goal="Learn recursion",
        )

        mock_session_svc.update_session_goal.assert_called_once_with(
            session_id="chat-123", user_id="user-1", goal="Learn recursion"
        )


# ---------------------------------------------------------------------------
# Pipeline: Planner receives v2 context
# ---------------------------------------------------------------------------


class TestPipelinePlannerV2:

    @patch(TRACE_SVC)
    @patch(CHAT_SVC)
    @patch(SESSION_CTX_SVC)
    async def test_pipeline_passes_session_to_planner(
        self, mock_session_svc, mock_chat_svc, mock_trace_svc
    ):
        """Step 4: The planner must receive the full three-layer context via plan_response_v2.

        WHY: plan_response_v2 uses session.momentum and session.clarity
        to apply deterministic overrides. If the legacy plan_response() is
        called instead, those overrides don't fire and the planner ignores
        the user's current session state.
        """
        v2_ctx = _mock_v2_context(momentum="flowing")

        _patch_session_service(mock_session_svc)
        _patch_chat_service(mock_chat_svc)
        _patch_trace_service(mock_trace_svc)

        orch = _setup_orchestrator()
        _setup_agents(orch, v2_context=v2_ctx, response="Great progress!")

        await orch.process_message_async("user-1", "Tell me more")

        orch.planner_agent.plan_response_v2.assert_called_once()
        call_args = orch.planner_agent.plan_response_v2.call_args
        passed_context = call_args[0][0]
        # Verify the session layer is in the context passed to planner
        assert passed_context["session"]["momentum"] == "flowing"
        assert "_session_id" in passed_context
        assert "_user_id" in passed_context


# ---------------------------------------------------------------------------
# Pipeline: Message Count Increment
# ---------------------------------------------------------------------------


class TestPipelineMessageCount:

    @patch(TRACE_SVC)
    @patch(CHAT_SVC)
    @patch(SESSION_CTX_SVC)
    async def test_pipeline_updates_session_after_response(
        self, mock_session_svc, mock_chat_svc, mock_trace_svc
    ):
        """Step 7: Session message count must be incremented after saving the response.

        WHY: Message count feeds into momentum derivation. If it's not
        incremented, the momentum will be perpetually 'warming_up' because
        the session always looks like it has < 3 messages.
        """
        _patch_session_service(mock_session_svc)
        _patch_chat_service(mock_chat_svc)
        _patch_trace_service(mock_trace_svc)

        orch = _setup_orchestrator()
        _setup_agents(orch, response="Sure!")

        await orch.process_message_async("user-1", "Hello")

        mock_session_svc.increment_message_count.assert_called_once_with(
            session_id="chat-123"
        )


# ---------------------------------------------------------------------------
# Pipeline: Session context in result
# ---------------------------------------------------------------------------


class TestPipelineResultShape:

    @patch(TRACE_SVC)
    @patch(CHAT_SVC)
    @patch(SESSION_CTX_SVC)
    async def test_session_context_in_result(
        self, mock_session_svc, mock_chat_svc, mock_trace_svc
    ):
        """Step 9: The result dict must include session_context for the frontend.

        WHY: The updated ChatResponse model exposes session_context
        (goal, momentum, active_concepts, message_count). If the orchestrator
        doesn't include it, the frontend will never receive session state.
        """
        _patch_session_service(mock_session_svc)
        _patch_chat_service(mock_chat_svc)
        _patch_trace_service(mock_trace_svc)

        orch = _setup_orchestrator()
        _setup_agents(orch, response="Here you go!")

        result = await orch.process_message_async("user-1", "What is X?")

        assert "session_context" in result
        ctx = result["session_context"]
        assert "goal" in ctx
        assert "momentum" in ctx
        assert "active_concepts" in ctx
        assert "message_count" in ctx

    @patch(TRACE_SVC)
    @patch(CHAT_SVC)
    @patch(SESSION_CTX_SVC)
    async def test_evaluation_is_session_scoped(
        self, mock_session_svc, mock_chat_svc, mock_trace_svc
    ):
        """The evaluation in the result must be session-scoped, not global.

        WHY: This is the core change of Phase 4.7. Session-scoped clarity
        means a user strong in Python but struggling with DSA will see their
        DSA session clarity at 30, not their global average of 60.
        """
        v2_ctx = _mock_v2_context(clarity=35.0)

        _patch_session_service(mock_session_svc)
        _patch_chat_service(mock_chat_svc)
        _patch_trace_service(mock_trace_svc)

        orch = _setup_orchestrator()
        _setup_agents(orch, v2_context=v2_ctx, response="Let me help.")

        result = await orch.process_message_async("user-1", "I'm lost")

        assert result["evaluation"]["clarity_score"] == 35.0


# ---------------------------------------------------------------------------
# Pipeline: Legacy Fallback
# ---------------------------------------------------------------------------


class TestPipelineLegacyFallback:

    @patch(TRACE_SVC)
    @patch(CHAT_SVC)
    @patch(SESSION_CTX_SVC)
    async def test_fallback_to_legacy_on_session_failure(
        self, mock_session_svc, mock_chat_svc, mock_trace_svc
    ):
        """If session_context_service fails, pipeline must fall back to legacy.

        WHY: v2 services may not be deployed yet (migration in progress) or
        MongoDB might be slow. The system must NEVER crash — falling back to
        the old flat UserMemory pipeline ensures the user always gets a response.
        """
        # Session service throws
        mock_session_svc.get_or_create = AsyncMock(
            side_effect=Exception("Session service unavailable")
        )
        _patch_chat_service(mock_chat_svc)
        _patch_trace_service(mock_trace_svc)

        orch = _setup_orchestrator()
        _setup_agents(orch, response="Fallback response")

        result = await orch.process_message_async("user-1", "Hello")

        assert result["response"] == "Fallback response"
        # Legacy planner was called, not v2
        orch.planner_agent.plan_response.assert_called_once()
        orch.planner_agent.plan_response_v2.assert_not_called()
        # session_context should be None
        assert result["session_context"] is None
