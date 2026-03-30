"""
Profile Service Tests — Phase 4.7 Layer 1 (Identity Memory)

Validates:
  - Default profile creation with sensible beginner defaults
  - Onboarding wizard field mapping (mentoring_style -> mentoring_tone, etc.)
  - Additive strengths/weaknesses with deduplication and capping

All MongoDB calls are mocked — zero network I/O.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.profile_service import ProfileService
from app.models.memory_v2 import UserProfileV2


pytestmark = pytest.mark.asyncio

COLLECTION_PATH = "app.services.profile_service.get_user_profiles_collection"


def _make_service() -> ProfileService:
    return ProfileService()


# ---------------------------------------------------------------------------
# Default Profile Creation
# ---------------------------------------------------------------------------


class TestCreateDefaultProfile:

    @patch(COLLECTION_PATH)
    async def test_create_default_profile(self, mock_col_fn):
        """A new user with no existing profile gets beginner-level defaults.

        WHY: The planner reads experience_level, mentoring_tone, and
        career_interests to decide strategy. If these are None or missing,
        the planner's prompt template will inject 'None' as literal text,
        producing nonsensical instructions for the LLM.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_col.insert_one = AsyncMock()
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        profile = await svc.get_or_create_profile("new-user")

        assert isinstance(profile, UserProfileV2)
        assert profile.user_id == "new-user"
        assert profile.experience_level == "beginner"
        assert profile.preferred_learning_style == "mixed"
        assert profile.mentoring_tone == "balanced"
        assert profile.career_interests == []
        assert profile.global_strengths == []
        assert profile.global_weaknesses == []
        mock_col.insert_one.assert_called_once()

    @patch(COLLECTION_PATH)
    async def test_existing_profile_returned_without_creation(self, mock_col_fn):
        """Existing profile is returned as-is, no duplicate write.

        WHY: The orchestrator calls get_or_create_profile every pipeline run.
        Double-writing would overwrite accumulated strengths/weaknesses with
        the defaults from UserProfileV2.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value={
            "_id": "abc123",
            "user_id": "user-1",
            "experience_level": "intermediate",
            "mentoring_tone": "challenging",
            "preferred_learning_style": "visual",
            "career_interests": ["machine-learning"],
            "global_strengths": ["problem-solving"],
            "global_weaknesses": ["time-complexity"],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        profile = await svc.get_or_create_profile("user-1")

        assert profile.experience_level == "intermediate"
        assert profile.mentoring_tone == "challenging"
        mock_col.insert_one = AsyncMock()
        mock_col.insert_one.assert_not_called()


# ---------------------------------------------------------------------------
# Onboarding Mapping
# ---------------------------------------------------------------------------


class TestUpdateFromOnboarding:

    @patch(COLLECTION_PATH)
    async def test_update_from_onboarding_full_mapping(self, mock_col_fn):
        """Wizard answers must be correctly mapped to profile fields.

        WHY: The mapping is the bridge between the user-facing wizard and
        the internal profile schema. If 'gentle' maps to 'challenging'
        instead of 'supportive', the mentor's tone will be wrong for the
        entire user lifecycle — a critical UX bug.

        Mapping table:
          mentoring_style 'gentle'     -> mentoring_tone 'supportive'
          mentoring_style 'supportive' -> mentoring_tone 'supportive'
          mentoring_style 'direct'     -> mentoring_tone 'balanced'
          mentoring_style 'challenging' -> mentoring_tone 'challenging'
          guidance_type 'skills'       -> career_interests ['skill-building']
        """
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock()
        # After upsert, get_or_create_profile is called to reload
        mock_col.find_one = AsyncMock(return_value={
            "_id": "abc",
            "user_id": "user-1",
            "experience_level": "intermediate",
            "mentoring_tone": "supportive",
            "preferred_learning_style": "mixed",
            "career_interests": ["skill-building"],
            "global_strengths": [],
            "global_weaknesses": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        profile = await svc.update_from_onboarding("user-1", {
            "experience_level": "intermediate",
            "mentoring_style": "gentle",
            "guidance_type": "skills",
        })

        # Verify the update_one was called with correct mapped values
        update_call = mock_col.update_one.call_args
        sets = update_call[0][1]["$set"]
        assert sets["experience_level"] == "intermediate"
        assert sets["mentoring_tone"] == "supportive"  # gentle -> supportive
        assert sets["career_interests"] == ["skill-building"]

    @patch(COLLECTION_PATH)
    async def test_challenging_maps_to_challenging(self, mock_col_fn):
        """The 'challenging' mentoring style maps directly (1:1).

        WHY: Unlike 'gentle' and 'supportive' (which merge), 'challenging'
        is its own tier. If this maps to 'balanced' by accident, users who
        explicitly asked for tough love get a watered-down experience.
        """
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock()
        mock_col.find_one = AsyncMock(return_value={
            "_id": "abc", "user_id": "user-1",
            "experience_level": "advanced", "mentoring_tone": "challenging",
            "preferred_learning_style": "mixed", "career_interests": [],
            "global_strengths": [], "global_weaknesses": [],
            "created_at": datetime.utcnow(), "updated_at": datetime.utcnow(),
        })
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_from_onboarding("user-1", {
            "experience_level": "advanced",
            "mentoring_style": "challenging",
            "guidance_type": "career",
        })

        sets = mock_col.update_one.call_args[0][1]["$set"]
        assert sets["mentoring_tone"] == "challenging"


# ---------------------------------------------------------------------------
# Strengths & Weaknesses
# ---------------------------------------------------------------------------


class TestUpdateStrengthsWeaknesses:

    @patch(COLLECTION_PATH)
    async def test_update_strengths_weaknesses_additive(self, mock_col_fn):
        """New strengths/weaknesses must be added via $addToSet (dedup by MongoDB).

        WHY: This is called by the evaluator when it detects cross-session
        patterns. Using $set would overwrite all existing entries; $addToSet
        ensures we accumulate without duplicates.
        """
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_strengths_weaknesses(
            "user-1",
            strengths=["problem-solving"],
            weaknesses=["time-complexity"],
        )

        first_call = mock_col.update_one.call_args_list[0]
        update_doc = first_call[0][1]
        assert "$addToSet" in update_doc
        assert update_doc["$addToSet"]["global_strengths"] == {"$each": ["problem-solving"]}
        assert update_doc["$addToSet"]["global_weaknesses"] == {"$each": ["time-complexity"]}

    @patch(COLLECTION_PATH)
    async def test_strengths_capped_at_20(self, mock_col_fn):
        """Both lists are capped at 20 entries via a follow-up $push/$slice.

        WHY: Unbounded lists would grow forever and eventually bloat the
        profile document beyond what's useful in a prompt. 20 is the cap.
        """
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_strengths_weaknesses(
            "user-1",
            strengths=["skill-A"],
            weaknesses=["skill-B"],
        )

        # Second update_one call should have $push/$slice for capping
        assert mock_col.update_one.call_count == 2
        cap_call = mock_col.update_one.call_args_list[1]
        cap_doc = cap_call[0][1]
        assert cap_doc["$push"]["global_strengths"]["$slice"] == -20
        assert cap_doc["$push"]["global_weaknesses"]["$slice"] == -20

    @patch(COLLECTION_PATH)
    async def test_empty_strengths_is_noop(self, mock_col_fn):
        """Passing empty lists must not trigger a DB write.

        WHY: Avoid unnecessary MongoDB round-trips when the evaluator
        has no new patterns to report.
        """
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock()
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_strengths_weaknesses("user-1")

        mock_col.update_one.assert_not_called()
