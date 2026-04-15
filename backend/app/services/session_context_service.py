"""
Session Context Service
Manages the lifecycle of SessionContext documents — Layer 3 (Working Memory)
of the Phase 4.7 three-layer memory architecture.

Cognitive science rationale:
    SessionContext models *working memory* — the small, goal-directed buffer of
    information a learner actively manipulates during a single conversation.
    Unlike long-term identity (Layer 1) or accumulated concept knowledge (Layer 2),
    working memory is ephemeral: it is created when a chat begins, updated every
    turn, and eventually expires (TTL 30 days via MongoDB).

    Key distinctions this service enforces:
    - Session clarity vs. global clarity: a user who is strong in Python but
      struggling with DSA will have a low clarity score *in the DSA session*
      without contaminating their overall profile.
    - Momentum = cognitive flow state: derived deterministically from message
      count and clarity trajectory, NOT from LLM inference. This keeps the
      signal fast and reproducible.
"""

import logging
from datetime import datetime
from typing import List, Optional

from app.db.mongodb import get_session_contexts_collection
from app.models.memory_v2 import SessionContext

logger = logging.getLogger(__name__)


class SessionContextService:
    """
    Stateless service for SessionContext CRUD.

    All state lives in MongoDB — no in-memory caching. Every method hits the
    database directly so that concurrent requests (e.g. rapid user messages)
    always see the latest state.
    """

    # --- Primary entry point ---------------------------------------------------

    async def get_or_create(self, session_id: str, user_id: str) -> SessionContext:
        """Load an existing SessionContext or create a fresh one.

        Args:
            session_id: Unique identifier for the chat session.
            user_id: Unique identifier for the learner.

        Returns:
            The loaded or newly initialized SessionContext object.
        """
        collection = get_session_contexts_collection()

        doc = await collection.find_one(
            {"session_id": session_id, "user_id": user_id}
        )

        if doc:
            doc["_id"] = str(doc["_id"])
            return SessionContext(**doc)

        # Create new context with cold-start defaults
        now = datetime.utcnow()
        new_ctx = SessionContext(
            session_id=session_id,
            user_id=user_id,
            session_goal=None,
            session_intent="unknown",
            goal_inferred=False,
            goal_confirmed=False,
            intent_classified_at_message=None,
            session_domain=None,
            active_concepts=[],
            session_clarity=50.0,
            session_confusion_points=[],
            message_count=0,
            session_momentum="cold_start",
            created_at=now,
            updated_at=now,
        )

        await collection.insert_one(
            new_ctx.model_dump(by_alias=True, exclude={"id"})
        )
        logger.debug(
            "Created SessionContext for session=%s user=%s", session_id, user_id
        )
        return new_ctx

    # --- Goal & domain ---------------------------------------------------------

    async def update_session_goal(
        self,
        session_id: str,
        user_id: str,
        goal: str,
        domain: Optional[str] = None,
    ) -> None:
        """Set or overwrite the session's inferred goal and domain.

        Args:
            session_id: The session being updated.
            user_id: The learner ID.
            goal: The inferred or confirmed learning objective.
            domain: Optional technical domain (e.g. 'React', 'DSA').

        Returns:
            None. Updates database record for working memory.
        """
        collection = get_session_contexts_collection()

        update: dict = {
            "$set": {
                "session_goal": goal,
                "updated_at": datetime.utcnow(),
            }
        }
        if domain is not None:
            update["$set"]["session_domain"] = domain

        result = await collection.update_one(
            {"session_id": session_id, "user_id": user_id}, update
        )
        logger.debug(
            "Updated goal for session=%s (matched=%d): goal=%r domain=%r",
            session_id,
            result.matched_count,
            goal,
            domain,
        )

    # --- Clarity & momentum ----------------------------------------------------

    async def update_clarity(
        self,
        session_id: str,
        clarity_score: float,
        confusion_points: Optional[List[str]] = None,
    ) -> None:
        """Atomically update session-scoped clarity and derive momentum.

        Args:
            session_id: The session being evaluated.
            clarity_score: 0-100 score indicating current understanding.
            confusion_points: Optional list of identified conceptual blockers.

        Returns:
            None. Calculates new momentum state based on clarity trajectory.
        """
        collection = get_session_contexts_collection()

        # Read current state for momentum calculation
        doc = await collection.find_one(
            {"session_id": session_id},
            {"session_clarity": 1, "message_count": 1},
        )

        if doc is None:
            logger.debug(
                "update_clarity skipped — no session context for session=%s",
                session_id,
            )
            return

        old_clarity = doc.get("session_clarity", 50.0)
        message_count = doc.get("message_count", 0)

        # Derive momentum from clarity trajectory
        momentum = self._derive_momentum(
            old_clarity=old_clarity,
            new_clarity=clarity_score,
            message_count=message_count,
        )

        # Clamp clarity to valid range
        clamped = max(0.0, min(100.0, clarity_score))

        update: dict = {
            "$set": {
                "session_clarity": clamped,
                "session_momentum": momentum,
                "updated_at": datetime.utcnow(),
            }
        }
        if confusion_points:
            # Deduplicate — $addToSet with $each only adds values not already present
            update["$addToSet"] = {
                "session_confusion_points": {"$each": confusion_points}
            }

        await collection.update_one({"session_id": session_id}, update)
        logger.debug(
            "Updated clarity for session=%s: %.1f→%.1f momentum=%s",
            session_id,
            old_clarity,
            clamped,
            momentum,
        )

    @staticmethod
    def _derive_momentum(
        old_clarity: float, new_clarity: float, message_count: int
    ) -> str:
        """
        Deterministic momentum derivation — no LLM, no randomness.

        Momentum maps to cognitive flow states:
            cold_start  → session just began, no data
            warming_up  → too few messages for a trend, or neutral trajectory
            flowing     → clarity is improving, learner is in the zone
            stuck       → clarity dropped, learner hit a wall
            wrapping_up → (set externally, never derived here)
        """
        if message_count < 3:
            return "warming_up"
        if new_clarity > old_clarity:
            return "flowing"
        if new_clarity < old_clarity:
            return "stuck"
        return "warming_up"

    # --- Active concepts -------------------------------------------------------

    async def add_active_concepts(
        self, session_id: str, concept_ids: List[str]
    ) -> None:
        """
        Add concepts to this session's active set (deduplicated).

        Active concepts tell the evaluator which ConceptRecords to update after
        scoring, keeping evaluation scoped to the current conversation topic.
        """
        if not concept_ids:
            return

        collection = get_session_contexts_collection()

        result = await collection.update_one(
            {"session_id": session_id},
            {
                "$addToSet": {"active_concepts": {"$each": concept_ids}},
                "$set": {"updated_at": datetime.utcnow()},
            },
        )
        logger.debug(
            "Added active concepts for session=%s (matched=%d): %s",
            session_id,
            result.matched_count,
            concept_ids,
        )

    # --- Message counter -------------------------------------------------------

    async def increment_message_count(self, session_id: str) -> None:
        """
        Atomically increment the session's message counter.

        Message count feeds into momentum derivation and helps the planner
        distinguish early-session exploration from deep-dive conversations.
        """
        collection = get_session_contexts_collection()

        await collection.update_one(
            {"session_id": session_id},
            {
                "$inc": {"message_count": 1},
                "$set": {"updated_at": datetime.utcnow()},
            },
        )
        logger.debug("Incremented message_count for session=%s", session_id)

    # --- Summary for agent prompts ---------------------------------------------

    async def get_session_summary(self, session_id: str) -> dict:
        """
        Return a compact dict of session state suitable for injection into
        agent prompts.

        This is the bridge between Layer 3 storage and the agent pipeline —
        agents receive this summary (not the raw document) so their context
        stays small and focused.

        Returns:
            dict with keys: goal, domain, clarity, momentum,
            active_concepts, confusion_points, message_count.
            Returns an empty-state dict if the session doesn't exist.
        """
        collection = get_session_contexts_collection()

        doc = await collection.find_one(
            {"session_id": session_id},
            {
                "session_goal": 1,
                "session_intent": 1,
                "goal_inferred": 1,
                "goal_confirmed": 1,
                "session_domain": 1,
                "session_clarity": 1,
                "session_momentum": 1,
                "active_concepts": 1,
                "session_confusion_points": 1,
                "message_count": 1,
            },
        )

        if doc is None:
            return {
                "session_id": session_id,
                "session_goal": None,
                "session_intent": "unknown",
                "goal_inferred": False,
                "goal_confirmed": False,
                "session_domain": None,
                "session_clarity": 50.0,
                "session_momentum": "cold_start",
                "active_concepts": [],
                "session_confusion_points": [],
                "message_count": 0,
            }

        return {
            "session_id": session_id,
            "session_goal": doc.get("session_goal"),
            "session_intent": doc.get("session_intent", "unknown"),
            "goal_inferred": doc.get("goal_inferred", False),
            "goal_confirmed": doc.get("goal_confirmed", False),
            "session_domain": doc.get("session_domain"),
            "session_clarity": doc.get("session_clarity", 50.0),
            "session_momentum": doc.get("session_momentum", "cold_start"),
            "active_concepts": doc.get("active_concepts", []),
            "session_confusion_points": doc.get("session_confusion_points", []),
            "message_count": doc.get("message_count", 0),
        }

    async def update_session(self, session_id: str, updates: dict) -> None:
        """Apply an arbitrary set of field updates to a SessionContext document.

        This is a generic escape hatch for cases where a dedicated method
        (update_clarity, update_session_goal, etc.) does not exist. Prefer the
        specific methods when possible; this should only be called for bulk or
        ad-hoc updates from the orchestrator.

        Args:
            session_id: The session to update.
            updates: Dict of {field_name: new_value} to $set on the document.
                     An updated_at timestamp is added automatically if absent.
        """
        collection = get_session_contexts_collection()
        
        # Don't overwrite updated_at if already there
        if "updated_at" not in updates:
            updates["updated_at"] = datetime.utcnow()
            
        await collection.update_one(
            {"session_id": session_id},
            {"$set": updates}
        )
        logger.debug(f"Updated session {session_id} with generic updates: {updates.keys()}")


# Singleton instance — matches codebase pattern (see chat_service.py)
session_context_service = SessionContextService()
