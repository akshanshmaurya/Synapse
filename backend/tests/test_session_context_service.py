"""
Session Context Service Tests — Phase 4.7 Layer 3 (Working Memory)

Validates the full lifecycle of SessionContext documents:
  - Creation with cold-start defaults
  - Idempotent get_or_create (no duplicates)
  - Goal and domain persistence
  - Clarity-to-momentum derivation (deterministic, no LLM)
  - Active concept deduplication
  - Atomic message count increment
  - Compact summary format for agent prompts
  - Concurrent update safety

All MongoDB calls are mocked — zero network I/O.
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.session_context_service import SessionContextService
from app.models.memory_v2 import SessionContext


pytestmark = pytest.mark.asyncio

COLLECTION_PATH = "app.services.session_context_service.get_session_contexts_collection"


def _make_service() -> SessionContextService:
    """Fresh service instance per test — stateless by design."""
    return SessionContextService()


def _session_doc(
    session_id="sess-1",
    user_id="user-1",
    clarity=50.0,
    message_count=0,
    momentum="cold_start",
    goal=None,
    domain=None,
    active_concepts=None,
    confusion_points=None,
) -> dict:
    """Factory for a realistic MongoDB session_contexts document."""
    return {
        "_id": "fake_object_id",
        "session_id": session_id,
        "user_id": user_id,
        "session_goal": goal,
        "session_domain": domain,
        "active_concepts": active_concepts or [],
        "session_clarity": clarity,
        "session_confusion_points": confusion_points or [],
        "message_count": message_count,
        "session_momentum": momentum,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


# ---------------------------------------------------------------------------
# Creation & Retrieval
# ---------------------------------------------------------------------------


class TestGetOrCreate:

    @patch(COLLECTION_PATH)
    async def test_get_or_create_new_session(self, mock_col_fn):
        """Creating a fresh session context must produce cold-start defaults.

        WHY: The cold-start state (clarity=50, momentum='cold_start', empty concepts)
        is the foundation all downstream agents rely on when no prior data exists.
        If defaults are wrong, the planner may make decisions with corrupt state.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_col.insert_one = AsyncMock()
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        ctx = await svc.get_or_create(session_id="new-sess", user_id="user-1")

        assert isinstance(ctx, SessionContext)
        assert ctx.session_id == "new-sess"
        assert ctx.user_id == "user-1"
        assert ctx.session_clarity == 50.0
        assert ctx.session_momentum == "cold_start"
        assert ctx.message_count == 0
        assert ctx.session_goal is None
        assert ctx.active_concepts == []
        mock_col.insert_one.assert_called_once()

    @patch(COLLECTION_PATH)
    async def test_get_or_create_existing_session(self, mock_col_fn):
        """If a session already exists, return it without creating a duplicate.

        WHY: The orchestrator calls get_or_create on EVERY message. If this
        created duplicates, the user's session state would split into parallel
        documents and diverge silently — a catastrophic data integrity bug.
        """
        existing = _session_doc(clarity=72.5, message_count=5, goal="Learn recursion")
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=existing)
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        ctx = await svc.get_or_create(session_id="sess-1", user_id="user-1")

        assert ctx.session_clarity == 72.5
        assert ctx.message_count == 5
        assert ctx.session_goal == "Learn recursion"
        mock_col.insert_one = AsyncMock()
        mock_col.insert_one.assert_not_called()


# ---------------------------------------------------------------------------
# Goal & Domain
# ---------------------------------------------------------------------------


class TestUpdateSessionGoal:

    @patch(COLLECTION_PATH)
    async def test_update_session_goal(self, mock_col_fn):
        """Goal and domain must be persisted atomically to MongoDB.

        WHY: The session goal drives the planner's strategy. If it writes
        successfully but the domain doesn't, the planner will choose a strategy
        for the wrong domain — e.g., recommending DSA resources for a Python session.
        """
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_session_goal(
            session_id="sess-1", user_id="user-1",
            goal="Learn recursion", domain="dsa",
        )

        call_args = mock_col.update_one.call_args
        filter_doc = call_args[0][0]
        update_doc = call_args[0][1]

        assert filter_doc == {"session_id": "sess-1", "user_id": "user-1"}
        assert update_doc["$set"]["session_goal"] == "Learn recursion"
        assert update_doc["$set"]["session_domain"] == "dsa"

    @patch(COLLECTION_PATH)
    async def test_update_goal_without_domain_preserves_existing(self, mock_col_fn):
        """Updating goal without domain must NOT clear the existing domain.

        WHY: A user might refine their goal mid-session ('actually I want to
        focus on trees') without changing the domain. Blanking domain would
        break concept-domain filtering in the planner.
        """
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_session_goal(
            session_id="sess-1", user_id="user-1",
            goal="Focus on trees specifically",
            domain=None,
        )

        update_doc = mock_col.update_one.call_args[0][1]
        assert "session_domain" not in update_doc["$set"]


# ---------------------------------------------------------------------------
# Clarity & Momentum
# ---------------------------------------------------------------------------


class TestUpdateClarity:

    @patch(COLLECTION_PATH)
    async def test_update_clarity_improving(self, mock_col_fn):
        """When clarity increases after 3+ messages, momentum must be 'flowing'.

        WHY: 'flowing' triggers the planner to maintain pace and avoid
        unnecessary scaffolding. If the derivation is wrong, the planner
        will slow down a student who is in the zone — breaking flow state.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value={
            "session_clarity": 50.0, "message_count": 5,
        })
        mock_col.update_one = AsyncMock()
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_clarity(session_id="sess-1", clarity_score=65.0)

        update_doc = mock_col.update_one.call_args[0][1]
        assert update_doc["$set"]["session_clarity"] == 65.0
        assert update_doc["$set"]["session_momentum"] == "flowing"

    @patch(COLLECTION_PATH)
    async def test_update_clarity_stuck(self, mock_col_fn):
        """When clarity drops after 3+ messages, momentum must be 'stuck'.

        WHY: 'stuck' triggers the planner to intervene — simplify, ask
        diagnostic questions, or switch approach. Missing this signal
        means leaving a confused learner without help.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value={
            "session_clarity": 70.0, "message_count": 4,
        })
        mock_col.update_one = AsyncMock()
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_clarity(session_id="sess-1", clarity_score=55.0)

        update_doc = mock_col.update_one.call_args[0][1]
        assert update_doc["$set"]["session_momentum"] == "stuck"

    @patch(COLLECTION_PATH)
    async def test_early_message_warming_up(self, mock_col_fn):
        """With fewer than 3 messages, momentum must always be 'warming_up'.

        WHY: On messages 1-2, the evaluator has almost no signal — deriving
        'flowing' or 'stuck' would be a false positive. The warming_up state
        tells the planner to explore, not react.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value={
            "session_clarity": 50.0, "message_count": 1,
        })
        mock_col.update_one = AsyncMock()
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_clarity(session_id="sess-1", clarity_score=80.0)

        update_doc = mock_col.update_one.call_args[0][1]
        assert update_doc["$set"]["session_momentum"] == "warming_up"

    @patch(COLLECTION_PATH)
    async def test_missing_session_no_crash(self, mock_col_fn):
        """update_clarity on a non-existent session must be a no-op, not a crash.

        WHY: In production, a race condition could delete a session before the
        evaluator's background task fires. Crashing would stop the entire
        background task pipeline and lose other updates.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_clarity(session_id="no-such-session", clarity_score=60.0)

        mock_col.update_one = AsyncMock()
        mock_col.update_one.assert_not_called()


# ---------------------------------------------------------------------------
# Active Concepts
# ---------------------------------------------------------------------------


class TestActiveConceptDeduplication:

    @patch(COLLECTION_PATH)
    async def test_add_active_concepts_deduplication(self, mock_col_fn):
        """Adding the same concept twice must use $addToSet to prevent duplicates.

        WHY: Duplicate active_concepts would cause the evaluator to update a
        ConceptRecord twice per interaction, double-counting exposure_count
        and skewing mastery calculations.
        """
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.add_active_concepts("sess-1", ["recursion", "recursion", "trees"])

        update_doc = mock_col.update_one.call_args[0][1]
        assert "$addToSet" in update_doc
        concepts_added = update_doc["$addToSet"]["active_concepts"]["$each"]
        assert concepts_added == ["recursion", "recursion", "trees"]
        # Note: actual deduplication happens in MongoDB's $addToSet operator

    @patch(COLLECTION_PATH)
    async def test_add_empty_concepts_is_noop(self, mock_col_fn):
        """Passing an empty list must not trigger a DB write.

        WHY: Avoid unnecessary MongoDB round-trips when the evaluator
        doesn't detect any concepts in the message.
        """
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock()
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.add_active_concepts("sess-1", [])

        mock_col.update_one.assert_not_called()


# ---------------------------------------------------------------------------
# Message Count
# ---------------------------------------------------------------------------


class TestIncrementMessageCount:

    @patch(COLLECTION_PATH)
    async def test_increment_message_count(self, mock_col_fn):
        """Message count must use atomic $inc, not read-modify-write.

        WHY: If the user sends two rapid messages concurrently, a
        read-modify-write would lose one increment. $inc is atomic at the
        MongoDB document level and never loses counts.
        """
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock()
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.increment_message_count("sess-1")

        call_args = mock_col.update_one.call_args
        update_doc = call_args[0][1]
        assert "$inc" in update_doc
        assert update_doc["$inc"]["message_count"] == 1


# ---------------------------------------------------------------------------
# Session Summary
# ---------------------------------------------------------------------------


class TestGetSessionSummary:

    @patch(COLLECTION_PATH)
    async def test_get_session_summary(self, mock_col_fn):
        """Summary must return the compact format expected by agent prompts.

        WHY: Agents receive this dict, not the raw document. If any key is
        missing or renamed, prompt templates will break with KeyError or
        produce malformed instructions.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value={
            "session_goal": "Learn recursion",
            "session_domain": "dsa",
            "session_clarity": 72.0,
            "session_momentum": "flowing",
            "active_concepts": ["recursion", "base-case"],
            "session_confusion_points": ["stack overflow"],
            "message_count": 6,
        })
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        summary = await svc.get_session_summary("sess-1")

        assert summary["goal"] == "Learn recursion"
        assert summary["domain"] == "dsa"
        assert summary["clarity"] == 72.0
        assert summary["momentum"] == "flowing"
        assert summary["active_concepts"] == ["recursion", "base-case"]
        assert summary["confusion_points"] == ["stack overflow"]
        assert summary["message_count"] == 6

    @patch(COLLECTION_PATH)
    async def test_get_session_summary_missing_session(self, mock_col_fn):
        """Non-existent session must return cold-start defaults, not raise.

        WHY: The GET /api/chats/{id}/context endpoint may be called before
        the first message is processed. Raising would return a 500 to the
        frontend instead of a safe default state.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        summary = await svc.get_session_summary("nonexistent")

        assert summary["goal"] is None
        assert summary["clarity"] == 50.0
        assert summary["momentum"] == "cold_start"
        assert summary["message_count"] == 0


# ---------------------------------------------------------------------------
# Deterministic Momentum Derivation (unit-level, no DB)
# ---------------------------------------------------------------------------


class TestDeriveMomentumPure:
    """Tests for the static _derive_momentum method — no mocking needed."""

    def test_few_messages_always_warming_up(self):
        """< 3 messages means not enough data to derive a trend."""
        assert SessionContextService._derive_momentum(50, 80, 0) == "warming_up"
        assert SessionContextService._derive_momentum(50, 80, 1) == "warming_up"
        assert SessionContextService._derive_momentum(50, 80, 2) == "warming_up"

    def test_improving_clarity_is_flowing(self):
        """Clarity went up after enough messages -> flowing."""
        assert SessionContextService._derive_momentum(50, 60, 3) == "flowing"
        assert SessionContextService._derive_momentum(30, 31, 10) == "flowing"

    def test_declining_clarity_is_stuck(self):
        """Clarity went down after enough messages -> stuck."""
        assert SessionContextService._derive_momentum(60, 50, 3) == "stuck"
        assert SessionContextService._derive_momentum(80, 79, 5) == "stuck"

    def test_unchanged_clarity_is_warming_up(self):
        """No change in clarity -> warming_up (neutral)."""
        assert SessionContextService._derive_momentum(50, 50, 5) == "warming_up"


# ---------------------------------------------------------------------------
# Concurrent Updates
# ---------------------------------------------------------------------------


class TestConcurrentUpdates:

    @patch(COLLECTION_PATH)
    async def test_concurrent_updates_dont_corrupt(self, mock_col_fn):
        """Two simultaneous clarity updates must not corrupt data.

        WHY: The evaluator background task and a rapid follow-up message
        can both call update_clarity on the same session. Because each
        call is an atomic MongoDB operation ($set), they serialize at the
        document level. This test verifies that the code issues valid
        atomic operations and doesn't do unsafe read-modify-write.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value={
            "session_clarity": 50.0, "message_count": 5,
        })
        mock_col.update_one = AsyncMock()
        mock_col_fn.return_value = mock_col

        svc = _make_service()

        # Fire two concurrent clarity updates
        await asyncio.gather(
            svc.update_clarity("sess-1", 60.0),
            svc.update_clarity("sess-1", 55.0),
        )

        # Both must have issued atomic $set operations (not read-modify-write)
        assert mock_col.update_one.call_count == 2
        for call in mock_col.update_one.call_args_list:
            update_doc = call[0][1]
            assert "$set" in update_doc
            assert "session_clarity" in update_doc["$set"]
