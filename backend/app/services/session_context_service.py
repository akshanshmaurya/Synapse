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
        """
        Load an existing SessionContext or create a fresh one.

        Called on EVERY incoming message by the Agent Orchestrator. The returned
        object gives agents a snapshot of the session's working memory so they
        can tailor their behaviour to the current conversation state.

        Returns:
            SessionContext — either the persisted document or a new default one.
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
        """
        Set (or overwrite) the session's inferred goal and optionally its domain.

        Called when:
        - The planner infers the user's intent from the first few messages.
        - The user explicitly states what they want to learn.

        If *domain* is None the existing domain is left untouched so that a
        goal refinement ("actually I want to focus on trees, not graphs") does
        not accidentally blank the domain.
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
        """
        Atomically update session-scoped clarity and derive momentum.

        Clarity is a 0–100 score produced by the evaluator FOR THIS SESSION
        ONLY. It is fundamentally different from the global clarity stored in
        the user profile — it cannot leak across topics.

        Momentum derivation (deterministic, no LLM):
            - < 3 messages          → "warming_up"  (not enough signal yet)
            - clarity improved      → "flowing"      (cognitive flow state)
            - clarity dropped       → "stuck"        (learner is struggling)
            - otherwise             → "warming_up"   (neutral default)

        Uses a single read to fetch previous clarity + message_count, then a
        single atomic write. This is the one method that requires a brief read
        before write — unavoidable because momentum depends on the *delta*
        between old and new clarity.
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
                "goal": None,
                "domain": None,
                "clarity": 50.0,
                "momentum": "cold_start",
                "active_concepts": [],
                "confusion_points": [],
                "message_count": 0,
            }

        return {
            "goal": doc.get("session_goal"),
            "domain": doc.get("session_domain"),
            "clarity": doc.get("session_clarity", 50.0),
            "momentum": doc.get("session_momentum", "cold_start"),
            "active_concepts": doc.get("active_concepts", []),
            "confusion_points": doc.get("session_confusion_points", []),
            "message_count": doc.get("message_count", 0),
        }


# Singleton instance — matches codebase pattern (see chat_service.py)
session_context_service = SessionContextService()
