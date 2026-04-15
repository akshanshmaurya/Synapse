"""Orchestrates data flow between the 3-layer memory system and the multi-agent pipeline.

By centralizing context retrieval and memory updates, this agent ensures that
all other specialized agents (Planner, Evaluator, Executor) have access to the
most relevant user facts and cognitive state at any point in the conversation.
"""

import time
from datetime import datetime
from typing import Dict, Any, Optional, List

from app.db.mongodb import get_user_memory_collection, get_interactions_collection, get_user_profiles_collection
from app.models.memory import UserMemory
from app.services.profile_service import profile_service
from app.services.concept_memory_service import concept_memory_service, slugify_concept
from app.services.session_context_service import session_context_service
from app.services.chat_service import chat_service
from app.services.learning_pattern_service import learning_pattern_service
from app.services.intent_classifier_service import ProfileSignals
from app.utils.logger import logger


class MemoryAgent:
    """
    Context assembler and memory coordinator.

    Two primary methods:
        retrieve_context  — assembles a structured context dict from all three layers
        update_memory     — dispatches evaluation results to the appropriate layers

    Legacy methods (get_user_context, update_struggle, etc.) are preserved for
    backward compatibility with call sites that haven't been migrated yet.
    They still write to the old user_memory collection.
    """

    # =========================================================================
    # NEW: Three-layer context assembly
    # =========================================================================

    async def retrieve_context(
        self, user_id: str, session_id: str, message: str
    ) -> dict:
        """Aggregate all memory layers into a single context object for the planner.

        Args:
            user_id: The unique identifier of the learner.
            session_id: The active conversation session identifier.
            message: The user's current message (reserved for pre-fetching).

        Returns:
            Structured context dict containing profile, session, and concept data.
        """
        missing: list = []
        timing: dict = {}

        # --- Layer 1: Profile (Identity Memory) ---
        t0 = time.monotonic()
        try:
            profile = await profile_service.get_profile_context_for_agents(user_id)
        except Exception as e:
            logger.error("retrieve_context: profile fetch failed for user=%s: %s", user_id, e)
            profile = {}
            missing.append("profile")
        timing["profile_ms"] = round((time.monotonic() - t0) * 1000, 1)

        # --- Layer 3: Session (Working Memory) ---
        t0 = time.monotonic()
        try:
            session = await session_context_service.get_session_summary(session_id)
        except Exception as e:
            logger.error("retrieve_context: session fetch failed for session=%s: %s", session_id, e)
            session = {
                "session_goal": None, "session_domain": None, "session_clarity": 50.0,
                "session_momentum": "cold_start", "active_concepts": [],
                "session_confusion_points": [], "message_count": 0,
                "session_intent": "unknown", "goal_inferred": False, "goal_confirmed": False
            }
            missing.append("session")
        timing["session_ms"] = round((time.monotonic() - t0) * 1000, 1)

        # --- Layer 2: Concepts (Knowledge Map) ---
        active_concepts = session.get("active_concepts", [])
        t0 = time.monotonic()
        try:
            concepts = await concept_memory_service.get_concept_context_for_agents(
                user_id, active_concepts
            )
        except Exception as e:
            logger.error("retrieve_context: concept fetch failed for user=%s: %s", user_id, e)
            concepts = {"active": {}, "related_weak": [], "overall_mastery_average": 0.0}
            missing.append("concepts")
        timing["concepts_ms"] = round((time.monotonic() - t0) * 1000, 1)

        # --- Recent messages (conversational context) ---
        t0 = time.monotonic()
        try:
            recent_messages = await chat_service.get_context_window(session_id, n=10)
        except Exception as e:
            logger.error("retrieve_context: message fetch failed for session=%s: %s", session_id, e)
            recent_messages = []
            missing.append("recent_messages")
        timing["messages_ms"] = round((time.monotonic() - t0) * 1000, 1)

        # --- Extract last_evaluation from the most recent mentor message ---
        last_evaluation = {}
        for msg in reversed(recent_messages):
            if msg.get("sender") in ("mentor", "system"):
                last_evaluation = msg.get("metadata", {}).get("evaluation", {})
                break

        # --- Learning Pattern Service (Phase 5.1/5.3) ---
        t0 = time.monotonic()
        try:
            velocity_data = await learning_pattern_service.analyze_learning_velocity(user_id)
            pattern_data = await learning_pattern_service.detect_struggle_patterns(user_id)
            pattern_insights = {
                "velocity": velocity_data,
                "struggle_patterns": pattern_data
            }
        except Exception as e:
            logger.warning("retrieve_context: pattern fetch failed for user=%s: %s", user_id, e)
            pattern_insights = {}
            # Do NOT mark as missing; patterns are optional.
        timing["patterns_ms"] = round((time.monotonic() - t0) * 1000, 1)

        # --- Context summary (deterministic, no LLM) ---
        context_summary = self._build_context_summary(profile, session, concepts)

        total_ms = sum(timing.values())
        timing["total_ms"] = round(total_ms, 1)

        logger.debug(
            "retrieve_context for user=%s session=%s: %s (missing=%s)",
            user_id, session_id, timing, missing or "none",
        )

        return {
            "profile": profile,
            "session": session,
            "concepts": concepts,
            "recent_messages": recent_messages,
            "pattern_insights": pattern_insights,
            "last_evaluation": last_evaluation,
            "context_summary": context_summary,
            "_timing": timing,
            "_missing": missing,
        }

    @staticmethod
    def _build_context_summary(profile: dict, session: dict, concepts: dict) -> str:
        """
        Rule-based context summary for agent prompts. No LLM calls.
        """
        experience = profile.get("experience_level", "beginner")
        interests = profile.get("career_interests", [])
        interests_str = ", ".join(interests) if interests else "not specified"

        goal = session.get("session_goal") or "not yet specified"
        momentum = session.get("session_momentum", "cold_start")
        clarity = session.get("session_clarity", 50.0)

        active_ids = list(concepts.get("active", {}).keys())
        active_str = ", ".join(active_ids) if active_ids else "none yet"

        return (
            f"User is a {experience} learner interested in {interests_str}. "
            f"In this session, they're working on: {goal}. "
            f"Session momentum: {momentum}. Current clarity: {clarity}/100. "
            f"Active concepts: {active_str}."
        )

    # =========================================================================
    # NEW: Three-layer memory update
    # =========================================================================

    async def update_memory(
        self, user_id: str, session_id: str, evaluation_result: dict
    ) -> None:
        """Dispatch evaluation results to the appropriate memory layers.

        Args:
            user_id: The unique identifier of the learner.
            session_id: Current chat session identifier.
            evaluation_result: Structured dict from Evaluator containing clarity,
                               mastery, and pattern signals.

        Returns:
            None. Updates are applied asynchronously across all three layers.
        """
        # --- Session layer (always) ---
        try:
            t0 = time.monotonic()
            clarity = evaluation_result.get("clarity_score", 50.0)
            confusion_points = evaluation_result.get("confusion_points", [])
            await session_context_service.update_clarity(
                session_id, clarity, confusion_points
            )
            await session_context_service.increment_message_count(session_id)
            logger.debug(
                "update_memory session layer: %.1fms",
                (time.monotonic() - t0) * 1000,
            )
        except Exception as e:
            logger.error("update_memory: session update failed for session=%s: %s", session_id, e)

        # --- Concept layer (if concepts identified) ---
        evaluated_concepts = evaluation_result.get("concepts", [])
        if evaluated_concepts:
            try:
                t0 = time.monotonic()
                concept_ids = []
                for c in evaluated_concepts:
                    raw_name = c.get("concept_name", "")
                    if not raw_name:
                        continue
                    cid = slugify_concept(raw_name)
                    concept_ids.append(cid)
                    await concept_memory_service.update_concept(
                        user_id=user_id,
                        concept_id=cid,
                        concept_name=raw_name,
                        domain=c.get("domain", "general"),
                        clarity_score=c.get("clarity", 50.0),
                        session_id=session_id,
                        misconceptions=c.get("misconceptions"),
                    )
                # Register active concepts in session
                if concept_ids:
                    await session_context_service.add_active_concepts(
                        session_id, concept_ids
                    )
                logger.debug(
                    "update_memory concept layer (%d concepts): %.1fms",
                    len(concept_ids),
                    (time.monotonic() - t0) * 1000,
                )
            except Exception as e:
                logger.error("update_memory: concept update failed for user=%s: %s", user_id, e)

        # --- Profile layer (rare — only on global pattern detection) ---
        new_strengths = evaluation_result.get("global_strengths")
        new_weaknesses = evaluation_result.get("global_weaknesses")
        if new_strengths or new_weaknesses:
            try:
                t0 = time.monotonic()
                await profile_service.update_strengths_weaknesses(
                    user_id,
                    strengths=new_strengths,
                    weaknesses=new_weaknesses,
                )
                logger.debug(
                    "update_memory profile layer: %.1fms",
                    (time.monotonic() - t0) * 1000,
                )
            except Exception as e:
                logger.error("update_memory: profile update failed for user=%s: %s", user_id, e)

    async def update_profile_signals(
        self,
        user_id: str,
        signals: ProfileSignals
    ) -> None:
        """Update UserProfile with soft signals extracted from any conversation.

        Args:
            user_id: The unique identifier of the learner.
            signals: Soft signals like interests, goals, and vocabulary level.

        Returns:
            None. Performs non-blocking updates to the identity memory layer.
        """
        
        if not signals.detected_interests and not signals.vocabulary_level and not signals.implicit_goals:
            return  # Nothing to update
        
        # Use MongoDB $addToSet to add new interests without creating duplicates
        # Use $set for vocabulary and communication style (latest wins)
        update_ops = {}
        
        if signals.detected_interests:
            # Merge into career_interests list — addToSet handles deduplication
            update_ops["$addToSet"] = {
                "career_interests": {"$each": signals.detected_interests}
            }
        
        if signals.vocabulary_level:
            # Only update if we have high enough confidence
            if getattr(signals, 'confidence', 0.0) >= 0.7:
                update_ops.setdefault("$set", {})
                update_ops["$set"]["inferred_vocabulary_level"] = signals.vocabulary_level
        
        if signals.implicit_goals:
            update_ops.setdefault("$addToSet", {})
            update_ops["$addToSet"].setdefault("implicit_career_signals", {})
            update_ops["$addToSet"]["implicit_career_signals"] = {
                "$each": signals.implicit_goals
            }
        
        if update_ops:
            try:
                profiles_coll = get_user_profiles_collection()
                await profiles_coll.update_one(
                    {"user_id": user_id},
                    update_ops,
                    upsert=False
                )
            except Exception as e:
                logger.warning(f"Profile signal update failed (non-critical): {e}")

    # =========================================================================
    # LEGACY: Preserved for backward compatibility with unmigrated call sites
    # (evaluator_agent.py, executor_agent.py, main.py)
    # These still write to the old user_memory collection.
    # DEPRECATED: Will be removed once all call sites use retrieve_context/update_memory.
    # =========================================================================

    async def get_user_context(self, user_id: str) -> Dict[str, Any]:
        """DEPRECATED: Use retrieve_context() instead. Kept for unmigrated call sites."""
        memory_collection = get_user_memory_collection()
        memory = await memory_collection.find_one({"user_id": user_id})

        if not memory:
            memory_doc = UserMemory(user_id=user_id).model_dump(exclude={"id"})
            await memory_collection.insert_one(memory_doc)
            memory = memory_doc

        interactions = get_interactions_collection()
        recent = await interactions.find(
            {"user_id": user_id}
        ).sort("created_at", -1).limit(5).to_list(length=5)

        return {
            "profile": memory.get("profile", {}),
            "struggles": memory.get("struggles", []),
            "progress": memory.get("progress", {}),
            "context_summary": memory.get("context_summary", ""),
            "recent_interactions": [
                {"user": i["user_message"], "mentor": i["mentor_response"][:200]}
                for i in recent
            ],
        }

    async def update_struggle(
        self,
        user_id: str,
        topic: str,
        severity: str = "mild",
        notes: Optional[str] = None,
    ):
        """DEPRECATED: Struggles are now tracked as concept misconceptions via update_memory()."""
        memory_collection = get_user_memory_collection()
        memory = await memory_collection.find_one({"user_id": user_id})

        if not memory:
            return

        struggles = memory.get("struggles", [])
        existing = next(
            (s for s in struggles if s.get("topic", "").lower() == topic.lower()),
            None,
        )

        if existing:
            existing["count"] = existing.get("count", 1) + 1
            existing["last_seen"] = datetime.utcnow()
            existing["severity"] = severity
            if notes:
                existing["notes"] = notes
        else:
            struggles.append({
                "topic": topic,
                "count": 1,
                "severity": severity,
                "last_seen": datetime.utcnow(),
                "notes": notes,
            })

        await memory_collection.update_one(
            {"user_id": user_id},
            {"$set": {"struggles": struggles, "updated_at": datetime.utcnow()}},
        )

    async def update_profile(
        self,
        user_id: str,
        interests: Optional[List[str]] = None,
        goals: Optional[List[str]] = None,
        stage: Optional[str] = None,
        learning_pace: Optional[str] = None,
    ):
        """DEPRECATED: Profile updates now go through ProfileService."""
        memory_collection = get_user_memory_collection()

        update_doc: dict = {"updated_at": datetime.utcnow()}
        if interests is not None:
            update_doc["profile.interests"] = interests
        if goals is not None:
            update_doc["profile.goals"] = goals
        if stage is not None:
            update_doc["profile.stage"] = stage
        if learning_pace is not None:
            update_doc["profile.learning_pace"] = learning_pace

        await memory_collection.update_one(
            {"user_id": user_id}, {"$set": update_doc}
        )

    async def store_evaluation_result(self, user_id: str, evaluation: Dict[str, Any]):
        """DEPRECATED: Evaluation results now flow through update_memory()."""
        memory_collection = get_user_memory_collection()

        snapshot = {
            "timestamp": datetime.utcnow(),
            "clarity_score": evaluation.get("clarity_score", 50),
            "confusion_trend": evaluation.get("confusion_trend", "stable"),
            "understanding_delta": evaluation.get("understanding_delta", 0),
            "stagnation_flags": evaluation.get("stagnation_flags", []),
            "engagement_level": evaluation.get("engagement_level", "medium"),
        }

        await memory_collection.update_one(
            {"user_id": user_id},
            {
                "$push": {
                    "progress.evaluation_history": {
                        "$each": [snapshot],
                        "$slice": -20,
                    }
                },
                "$set": {"updated_at": datetime.utcnow()},
            },
        )

    async def update_effort_metrics(self, user_id: str, session_occurred: bool = True):
        """DEPRECATED: Session tracking now handled by SessionContextService."""
        memory_collection = get_user_memory_collection()
        memory = await memory_collection.find_one({"user_id": user_id})

        if not memory:
            return

        effort = memory.get("progress", {}).get("effort_metrics", {})
        now = datetime.utcnow()
        last_session = effort.get("last_session_date")

        current_streak = effort.get("consistency_streak", 0)
        if last_session:
            if isinstance(last_session, datetime):
                days_since = (now.date() - last_session.date()).days
                if days_since == 1:
                    current_streak += 1
                elif days_since > 1:
                    current_streak = 1
            else:
                current_streak = 1
        else:
            current_streak = 1

        update_ops: dict = {
            "$inc": {"progress.effort_metrics.total_sessions": 1 if session_occurred else 0},
            "$set": {
                "progress.effort_metrics.consistency_streak": current_streak,
                "progress.effort_metrics.last_session_date": now,
                "updated_at": now,
            },
        }

        if session_occurred:
            update_ops["$push"] = {
                "progress.session_dates": {
                    "$each": [now],
                    "$slice": -100,
                }
            }

        await memory_collection.update_one({"user_id": user_id}, update_ops)

    async def update_learner_traits(self, user_id: str):
        """DEPRECATED: Trait analysis now handled by evaluator -> update_memory() -> ProfileService."""
        memory_collection = get_user_memory_collection()
        memory = await memory_collection.find_one({"user_id": user_id})

        if not memory:
            return

        eval_history = memory.get("progress", {}).get("evaluation_history", [])
        effort = memory.get("progress", {}).get("effort_metrics", {})

        if len(eval_history) < 5:
            return

        total_sessions = effort.get("total_sessions", 0)
        avg_clarity = sum(
            e.get("clarity_score", 50) for e in eval_history[-10:]
        ) / min(10, len(eval_history))

        if total_sessions > 10 and avg_clarity < 40:
            perseverance = "high"
        elif total_sessions > 5:
            perseverance = "moderate"
        else:
            perseverance = "low"

        worsening_count = sum(
            1 for e in eval_history if e.get("confusion_trend") == "worsening"
        )
        if worsening_count > 3 and total_sessions > worsening_count * 2:
            frustration_tolerance = "high"
        elif worsening_count > 2:
            frustration_tolerance = "moderate"
        else:
            frustration_tolerance = "moderate"

        await memory_collection.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "profile.perseverance": perseverance,
                    "profile.frustration_tolerance": frustration_tolerance,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
