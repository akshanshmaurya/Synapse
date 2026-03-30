"""
Profile Service
Manages Layer 1 (Identity Memory) of the Phase 4.7 three-layer memory architecture.

Cognitive science rationale:
    The user profile models *semantic self-knowledge* — the stable, slowly-changing
    facts about who the learner is. These persist indefinitely and inform every
    interaction regardless of the current topic or session.

    Unlike concept memory (Layer 2) which tracks what the user knows, and session
    context (Layer 3) which tracks the current conversation, the profile answers:
    "Who is this person and how should we communicate with them?"

    This is the LEAST frequently written layer. Most fields are set once during
    onboarding and rarely change. The only automatically evolving fields are
    global_strengths and global_weaknesses, which the evaluator updates after
    detecting cross-session patterns (roughly every 5-10 sessions).
"""

import logging
from datetime import datetime
from typing import List, Optional

from app.db.mongodb import get_user_profiles_collection
from app.models.memory_v2 import UserProfileV2

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Onboarding field mappings
# ---------------------------------------------------------------------------
# The onboarding wizard uses different field names and value sets than the
# UserProfileV2 model. These maps bridge the two without changing either.

# Onboarding "mentoring_style" -> UserProfileV2 "mentoring_tone"
# The old model had 4 values; the new model has 3. "gentle" and "supportive"
# both map to "supportive" because they express the same pedagogical intent.
_TONE_MAP = {
    "gentle": "supportive",
    "supportive": "supportive",
    "direct": "balanced",
    "challenging": "challenging",
}

# Onboarding "guidance_type" -> career_interests list
# The wizard captures a single intent string; we translate it to domain tags
# that the planner and executor can filter on.
_GUIDANCE_TO_INTERESTS = {
    "career": ["career-growth"],
    "skills": ["skill-building"],
    "goals": ["goal-planning"],
    "confidence": ["confidence-building"],
    "balance": ["work-life-balance"],
}


class ProfileService:
    """
    Stateless service for UserProfileV2 CRUD.

    All state lives in MongoDB. Profile writes are rare (onboarding + periodic
    evaluator updates), so there is no caching or batching.
    """

    # --- Load / bootstrap ------------------------------------------------------

    async def get_or_create_profile(self, user_id: str) -> UserProfileV2:
        """
        Load the user's identity profile, creating one with defaults if absent.

        Called during onboarding and by MemoryAgent at the start of every
        orchestration cycle.

        Returns:
            UserProfileV2 — either persisted or freshly created with defaults.
        """
        collection = get_user_profiles_collection()

        doc = await collection.find_one({"user_id": user_id})

        if doc:
            doc["_id"] = str(doc["_id"])
            return UserProfileV2(**doc)

        now = datetime.utcnow()
        profile = UserProfileV2(
            user_id=user_id,
            created_at=now,
            updated_at=now,
        )
        await collection.insert_one(
            profile.model_dump(by_alias=True, exclude={"id"})
        )
        logger.debug("Created default UserProfileV2 for user=%s", user_id)
        return profile

    # --- Onboarding ------------------------------------------------------------

    async def update_from_onboarding(
        self, user_id: str, data: dict
    ) -> UserProfileV2:
        """
        Map onboarding wizard answers to profile fields.

        The onboarding endpoint (routes/onboarding.py) collects three fields:
            - experience_level: "beginner" | "intermediate" | "advanced"
            - mentoring_style:  "gentle" | "supportive" | "direct" | "challenging"
            - guidance_type:    "career" | "skills" | "goals" | "confidence" | "balance"

        This method translates them into UserProfileV2's vocabulary and persists
        the update atomically. If the user_profiles document doesn't exist yet
        it is created via upsert.

        Args:
            user_id: The learner.
            data: Raw onboarding dict (keys match OnboardingRequest schema).

        Returns:
            The updated UserProfileV2 document.
        """
        collection = get_user_profiles_collection()
        now = datetime.utcnow()

        sets: dict = {"updated_at": now}

        # experience_level — direct pass-through (same enum values)
        exp = data.get("experience_level")
        if exp and exp in {"absolute_beginner", "beginner", "intermediate", "advanced"}:
            sets["experience_level"] = exp

        # mentoring_style -> mentoring_tone (mapped)
        style = data.get("mentoring_style")
        if style and style in _TONE_MAP:
            sets["mentoring_tone"] = _TONE_MAP[style]

        # guidance_type -> career_interests (expanded to list)
        guidance = data.get("guidance_type")
        if guidance and guidance in _GUIDANCE_TO_INTERESTS:
            sets["career_interests"] = _GUIDANCE_TO_INTERESTS[guidance]

        await collection.update_one(
            {"user_id": user_id},
            {
                "$set": sets,
                "$setOnInsert": {
                    "user_id": user_id,
                    "created_at": now,
                    "global_strengths": [],
                    "global_weaknesses": [],
                },
            },
            upsert=True,
        )
        logger.debug(
            "Updated profile from onboarding for user=%s: %s",
            user_id,
            {k: v for k, v in sets.items() if k != "updated_at"},
        )

        return await self.get_or_create_profile(user_id)

    # --- Evaluator-driven updates ----------------------------------------------

    async def update_strengths_weaknesses(
        self,
        user_id: str,
        strengths: Optional[List[str]] = None,
        weaknesses: Optional[List[str]] = None,
    ) -> None:
        """
        Append new strengths/weaknesses to the profile (deduplicated, capped).

        Called by the evaluator after detecting cross-session patterns — this is
        a slow signal that evolves over many conversations, not per-message.

        Both lists are capped at 20 entries to prevent unbounded growth. The
        cap is applied via a follow-up $push/$slice after the $addToSet so that
        MongoDB handles deduplication and trimming atomically.
        """
        collection = get_user_profiles_collection()
        now = datetime.utcnow()

        update: dict = {"$set": {"updated_at": now}}

        add_to_set: dict = {}
        if strengths:
            add_to_set["global_strengths"] = {"$each": strengths}
        if weaknesses:
            add_to_set["global_weaknesses"] = {"$each": weaknesses}

        if not add_to_set:
            return

        update["$addToSet"] = add_to_set

        result = await collection.update_one({"user_id": user_id}, update)

        # Cap both lists at 20 (keep most recent) — separate atomic op
        # because $addToSet and $push/$slice can't target the same field
        cap_push: dict = {}
        if strengths:
            cap_push["global_strengths"] = {"$each": [], "$slice": -20}
        if weaknesses:
            cap_push["global_weaknesses"] = {"$each": [], "$slice": -20}

        if cap_push:
            await collection.update_one(
                {"user_id": user_id}, {"$push": cap_push}
            )

        logger.debug(
            "Updated strengths/weaknesses for user=%s (matched=%d): +%d strengths, +%d weaknesses",
            user_id,
            result.matched_count,
            len(strengths or []),
            len(weaknesses or []),
        )

    # --- Compact context for agents --------------------------------------------

    async def get_profile_context_for_agents(self, user_id: str) -> dict:
        """
        Build a compact profile summary for injection into agent prompts.

        This is the bridge between Layer 1 (identity) and the agent pipeline.
        Agents receive this small dict so they know who they're talking to
        without seeing the full document.

        Returns:
            {
                experience_level, preferred_learning_style, mentoring_tone,
                career_interests, strengths_summary, weaknesses_summary
            }
            Returns a default-state dict if the profile doesn't exist.
        """
        collection = get_user_profiles_collection()

        doc = await collection.find_one(
            {"user_id": user_id},
            {
                "experience_level": 1,
                "preferred_learning_style": 1,
                "mentoring_tone": 1,
                "career_interests": 1,
                "global_strengths": 1,
                "global_weaknesses": 1,
            },
        )

        if not doc:
            return {
                "experience_level": "beginner",
                "preferred_learning_style": "mixed",
                "mentoring_tone": "balanced",
                "career_interests": [],
                "strengths_summary": [],
                "weaknesses_summary": [],
            }

        return {
            "experience_level": doc.get("experience_level", "beginner"),
            "preferred_learning_style": doc.get("preferred_learning_style", "mixed"),
            "mentoring_tone": doc.get("mentoring_tone", "balanced"),
            "career_interests": doc.get("career_interests", []),
            "strengths_summary": doc.get("global_strengths", [])[:5],
            "weaknesses_summary": doc.get("global_weaknesses", [])[:5],
        }


# Singleton instance — matches codebase pattern (see chat_service.py)
profile_service = ProfileService()
