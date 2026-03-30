"""
Learning Cycle Service (Phase 5.4B)

Meta-service that orchestrates the feedback loop at a higher level than
per-message interactions. It decides WHEN to run expensive pattern analysis
and applies the results to the user's profile.

This service:
    - NEVER blocks the user response (runs in background only)
    - Throttles analysis to at most once per 5 minutes per user
    - Logs every analysis to the learning_analyses collection for research
    - Only applies profile updates when confidence > 0.6

Trigger rules (all deterministic):
    1. Every 10 messages within a session
    2. Session clarity drops below 25 (crisis threshold)
    3. At most once per 5 minutes per user (throttle)
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any

from app.db.mongodb import get_learning_analyses_collection, get_session_contexts_collection
from app.services.learning_pattern_service import learning_pattern_service
from app.services.profile_service import profile_service

logger = logging.getLogger(__name__)

# Minimum interval between analyses for a single user (seconds)
_THROTTLE_SECONDS = 300  # 5 minutes


class LearningCycleService:
    """Orchestrates periodic learning pattern analysis and profile updates."""

    async def should_run_analysis(
        self, session_id: str, user_id: str
    ) -> bool:
        """Determine if it's time to run pattern analysis.

        Rules (checked in order):
            1. Every 10 messages within a session → run
            2. Session clarity < 25 (crisis) → run immediately
            3. At most once per 5 minutes per user (throttle)

        All rules are deterministic — no LLM, no randomness.
        """
        # --- Read session state ---
        collection = get_session_contexts_collection()
        doc = await collection.find_one(
            {"session_id": session_id, "user_id": user_id},
            {"message_count": 1, "session_clarity": 1},
        )

        if not doc:
            return False

        message_count = doc.get("message_count", 0)
        clarity = doc.get("session_clarity", 50.0)

        # Rule 1: Every 10 messages
        trigger_by_count = message_count > 0 and message_count % 10 == 0

        # Rule 2: Crisis threshold
        trigger_by_crisis = clarity < 25

        if not (trigger_by_count or trigger_by_crisis):
            return False

        # Rule 3: Throttle — at most once per 5 minutes per user
        analyses = get_learning_analyses_collection()
        cutoff = datetime.utcnow() - timedelta(seconds=_THROTTLE_SECONDS)
        recent = await analyses.find_one(
            {"user_id": user_id, "timestamp": {"$gte": cutoff}},
            {"_id": 1},
        )

        if recent:
            logger.debug(
                "Skipping analysis for user=%s — throttled (last run < 5 min ago)",
                user_id,
            )
            return False

        logger.debug(
            "Analysis triggered for user=%s session=%s (count=%d clarity=%.1f)",
            user_id, session_id, message_count, clarity,
        )
        return True

    async def run_learning_cycle(
        self, user_id: str, session_id: str
    ) -> Dict[str, Any]:
        """Execute the full pattern analysis and apply recommendations.

        Steps:
            1. Analyze learning velocity across concepts
            2. Detect structural struggle patterns
            3. Generate profile update recommendations
            4. If confidence > 0.6, apply strength/weakness updates
            5. Store everything in learning_analyses for audit

        Returns:
            Analysis result dict for potential UI display.
        """
        start_time = time.time()

        try:
            # Step 1: Velocity
            velocity_result = await learning_pattern_service.analyze_learning_velocity(
                user_id
            )

            # Step 2: Struggle patterns
            pattern_result = await learning_pattern_service.detect_struggle_patterns(
                user_id
            )

            # Step 3: Profile update recommendations
            update_result = await learning_pattern_service.generate_learning_profile_update(
                user_id
            )

            # Step 4: Apply if confident
            profile_update_applied = False
            confidence = update_result.get("confidence", 0.0)

            if confidence > 0.6:
                strengths = update_result.get("suggested_strength_additions", [])
                weaknesses = update_result.get("suggested_weakness_additions", [])

                if strengths or weaknesses:
                    await profile_service.update_strengths_weaknesses(
                        user_id=user_id,
                        strengths=strengths,
                        weaknesses=weaknesses,
                    )
                    profile_update_applied = True
                    logger.info(
                        "Applied profile updates for user=%s: +%d strengths, +%d weaknesses (confidence=%.2f)",
                        user_id, len(strengths), len(weaknesses), confidence,
                    )

            # Step 5: Store analysis for audit trail
            analysis_doc = {
                "user_id": user_id,
                "session_id": session_id,
                "timestamp": datetime.utcnow(),
                "velocity": velocity_result,
                "patterns": pattern_result,
                "profile_update_applied": profile_update_applied,
                "profile_update": update_result,
                "elapsed_ms": round((time.time() - start_time) * 1000, 1),
            }

            analyses = get_learning_analyses_collection()
            await analyses.insert_one(analysis_doc)

            logger.info(
                "Learning cycle complete for user=%s in %.1fms (profile_updated=%s)",
                user_id, analysis_doc["elapsed_ms"], profile_update_applied,
            )

            return analysis_doc

        except Exception as e:
            logger.error(
                "Learning cycle failed for user=%s: %s", user_id, e, exc_info=True
            )
            return {"status": "error", "error": str(e)}


# Singleton instance
learning_cycle_service = LearningCycleService()
