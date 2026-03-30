"""
Concept Memory Service Tests — Phase 4.7 Layer 2 (Knowledge Map)

Validates:
  - Concept creation on first encounter
  - Mastery formula: (0.6*clarity) + (0.3*exposure) + (0.1*recency)
  - Recency decay (Ebbinghaus-inspired forgetting curve)
  - Misconception tracking with deduplication
  - Mastery history capping at 10 entries
  - Weak concept filtering
  - Related concept queries by domain
  - slugify_concept edge cases

All MongoDB calls are mocked — zero network I/O.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.concept_memory_service import (
    ConceptMemoryService,
    slugify_concept,
    _calculate_mastery,
    _recency_factor,
)
from app.models.memory_v2 import ConceptRecord


pytestmark = pytest.mark.asyncio

COLLECTION_PATH = "app.services.concept_memory_service.get_concept_memory_collection"


def _make_service() -> ConceptMemoryService:
    return ConceptMemoryService()


# ---------------------------------------------------------------------------
# slugify_concept — pure function, no mocking
# ---------------------------------------------------------------------------


class TestSlugifyConcept:

    def test_basic_slugification(self):
        """Standard title-case name produces lowercase hyphenated slug.

        WHY: Concept IDs are used as MongoDB document keys. Inconsistent
        casing would create duplicate entries ('Recursion' vs 'recursion').
        """
        assert slugify_concept("Binary Search") == "binary-search"

    def test_oop_inheritance(self):
        """Multi-word compound names preserve hyphens."""
        assert slugify_concept("OOP Inheritance") == "oop-inheritance"

    def test_special_characters_stripped(self):
        """Apostrophes, slashes, and extra whitespace are cleaned."""
        assert slugify_concept("Two's Complement") == "twos-complement"
        assert slugify_concept(" DFS / BFS ") == "dfs-bfs"

    def test_multiple_hyphens_collapsed(self):
        """Consecutive hyphens collapse to a single one."""
        assert slugify_concept("A  --  B") == "a-b"

    def test_empty_string(self):
        """Edge case: empty string produces empty slug."""
        assert slugify_concept("") == ""


# ---------------------------------------------------------------------------
# Recency Factor — pure function, no mocking
# ---------------------------------------------------------------------------


class TestRecencyFactor:

    def test_within_7_days_full_score(self):
        """Concepts seen within 7 days have full recency (1.0).

        WHY: The forgetting curve only kicks in after a week. Within that
        window, we assume the learner still has fresh recall.
        """
        recent = datetime.utcnow() - timedelta(days=3)
        assert _recency_factor(recent) == 1.0

    def test_14_days_decayed(self):
        """Concepts seen 14 days ago lose 0.1 recency (one extra week)."""
        old = datetime.utcnow() - timedelta(days=14)
        factor = _recency_factor(old)
        assert 0.85 <= factor <= 0.95  # ~0.9

    def test_77_days_is_zero(self):
        """After ~77 days (10 weeks past first week), recency floors at 0.0.

        WHY: Preventing negative recency ensures mastery never goes below zero.
        """
        very_old = datetime.utcnow() - timedelta(days=77)
        assert _recency_factor(very_old) == 0.0


# ---------------------------------------------------------------------------
# Mastery Calculation — pure function, no mocking
# ---------------------------------------------------------------------------


class TestMasteryCalculation:

    def test_mastery_formula_basic(self):
        """Verify the weighted mastery formula: 0.6*clarity + 0.3*exposure + 0.1*recency.

        WHY: This is the core deterministic formula that replaces LLM-based
        mastery judgment. If the weights or normalization are wrong, the entire
        knowledge layer produces incorrect signals for the planner.
        """
        now = datetime.utcnow()
        # clarity=80/100=0.8, exposure=5/10=0.5, recency=1.0 (within 7 days)
        mastery = _calculate_mastery(80.0, 5, now)
        expected = (0.6 * 0.8) + (0.3 * 0.5) + (0.1 * 1.0)
        assert abs(mastery - expected) < 0.01

    def test_mastery_clamped_to_zero_one(self):
        """Mastery is clamped to [0.0, 1.0] even with extreme inputs.

        WHY: Downstream code (planner momentum overrides, weak concept queries)
        assumes mastery is in [0, 1]. Values outside this range would break
        threshold comparisons.
        """
        now = datetime.utcnow()
        assert _calculate_mastery(0, 0, now) >= 0.0
        assert _calculate_mastery(200, 100, now) <= 1.0

    def test_mastery_with_recency_decay(self):
        """Old concepts have lower mastery than recent ones with same clarity.

        WHY: This models the Ebbinghaus forgetting effect — a concept last
        seen 6 weeks ago should have lower mastery than one seen yesterday,
        even if both scored the same clarity. Without decay, the planner
        would never suggest reviewing old material.
        """
        now = datetime.utcnow()
        recent_mastery = _calculate_mastery(80.0, 5, now)

        old_date = now - timedelta(days=42)  # 6 weeks ago
        old_mastery = _calculate_mastery(80.0, 5, old_date)

        assert old_mastery < recent_mastery

    def test_mastery_exposure_capped_at_10(self):
        """Exposure factor caps at 10 interactions (diminishing returns).

        WHY: Beyond 10 exposures, additional practice has negligible impact on
        mastery. This models the learning science principle that initial
        practice has the highest marginal benefit.
        """
        now = datetime.utcnow()
        m_10 = _calculate_mastery(80.0, 10, now)
        m_100 = _calculate_mastery(80.0, 100, now)
        assert m_10 == m_100  # Identical once capped


# ---------------------------------------------------------------------------
# Concept Creation & Update
# ---------------------------------------------------------------------------


class TestConceptCreation:

    @patch(COLLECTION_PATH)
    async def test_new_concept_creation(self, mock_col_fn):
        """First encounter with a concept creates a new record with exposure=1.

        WHY: Correct initialization is critical — starting with exposure=0
        would produce mastery=0 even with high clarity, because the exposure
        factor would be zero.
        """
        mock_col = MagicMock()
        # First call: ensure doc exists (upsert)
        mock_col.update_one = AsyncMock()
        # Second call: read existing concept (not found -> new)
        mock_col.find_one = AsyncMock(return_value={"concepts": {}})
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_concept(
            user_id="user-1",
            concept_id="binary-search",
            concept_name="Binary Search",
            domain="dsa",
            clarity_score=70.0,
            session_id="sess-1",
        )

        # Should have called update_one 2x: once for upsert, once for concept write
        assert mock_col.update_one.call_count == 2
        # The second call should $set the new concept
        second_call = mock_col.update_one.call_args_list[1]
        update_doc = second_call[0][1]
        concept_record = update_doc["$set"]["concepts.binary-search"]
        assert concept_record["exposure_count"] == 1
        assert concept_record["concept_name"] == "Binary Search"
        assert concept_record["domain"] == "dsa"

    @patch(COLLECTION_PATH)
    async def test_misconception_tracking(self, mock_col_fn):
        """Misconceptions must be added via $addToSet (deduplicated) to the concept.

        WHY: If misconceptions duplicated, the planner would over-weight
        a single misconception, distorting the 'misconception density' signal
        used to decide intervention intensity.
        """
        existing_concept = {
            "concept_id": "recursion",
            "exposure_count": 3,
            "first_seen": datetime.utcnow(),
            "misconceptions": ["infinite loop"],
        }
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock()
        mock_col.find_one = AsyncMock(return_value={
            "concepts": {"recursion": existing_concept},
        })
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_concept(
            user_id="user-1",
            concept_id="recursion",
            concept_name="Recursion",
            domain="dsa",
            clarity_score=60.0,
            session_id="sess-1",
            misconceptions=["infinite loop", "stack overflow"],
        )

        # Third call (after upsert + update) is the misconception cap
        calls = mock_col.update_one.call_args_list
        # The update call should use $addToSet for misconceptions
        update_call = calls[1]
        update_doc = update_call[0][1]
        assert "$addToSet" in update_doc
        misconceptions_added = update_doc["$addToSet"]["concepts.recursion.misconceptions"]["$each"]
        assert "infinite loop" in misconceptions_added
        assert "stack overflow" in misconceptions_added


class TestMasteryHistoryCapping:

    @patch(COLLECTION_PATH)
    async def test_mastery_history_keeps_only_10(self, mock_col_fn):
        """Mastery history must be capped at 10 via $push/$slice.

        WHY: Unbounded history would grow the document forever. The dashboard
        only needs the last 10 readings for trend visualization. Capping at 10
        also keeps document size predictable for MongoDB performance.
        """
        existing = {
            "concept_id": "recursion",
            "exposure_count": 8,
            "first_seen": datetime.utcnow(),
            "mastery_history": [{"date": datetime.utcnow(), "score": 0.5, "session_id": f"s{i}"} for i in range(9)],
        }
        mock_col = MagicMock()
        mock_col.update_one = AsyncMock()
        mock_col.find_one = AsyncMock(return_value={"concepts": {"recursion": existing}})
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        await svc.update_concept(
            user_id="user-1", concept_id="recursion",
            concept_name="Recursion", domain="dsa",
            clarity_score=75.0, session_id="sess-10",
        )

        update_call = mock_col.update_one.call_args_list[1]
        update_doc = update_call[0][1]
        push_spec = update_doc["$push"]["concepts.recursion.mastery_history"]
        assert push_spec["$slice"] == -10


# ---------------------------------------------------------------------------
# Query Helpers
# ---------------------------------------------------------------------------


class TestGetWeakConcepts:

    @patch(COLLECTION_PATH)
    async def test_get_weak_concepts(self, mock_col_fn):
        """Weak concepts are those with mastery < threshold (default 0.4).

        WHY: The planner uses weak concepts to suggest review sessions.
        If the filter is wrong (e.g., using > instead of <), the planner
        would recommend reviewing topics the user already knows well.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value={
            "concepts": {
                "recursion": {
                    "concept_id": "recursion", "concept_name": "Recursion",
                    "domain": "dsa", "mastery_level": 0.3,
                    "exposure_count": 2, "last_clarity_score": 40,
                    "misconceptions": [], "first_seen": datetime.utcnow(),
                    "last_seen": datetime.utcnow(), "mastery_history": [],
                },
                "sorting": {
                    "concept_id": "sorting", "concept_name": "Sorting",
                    "domain": "dsa", "mastery_level": 0.8,
                    "exposure_count": 5, "last_clarity_score": 90,
                    "misconceptions": [], "first_seen": datetime.utcnow(),
                    "last_seen": datetime.utcnow(), "mastery_history": [],
                },
            }
        })
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        weak = await svc.get_weak_concepts("user-1", threshold=0.4)

        assert len(weak) == 1
        assert weak[0].concept_id == "recursion"

    @patch(COLLECTION_PATH)
    async def test_get_weak_concepts_empty_memory(self, mock_col_fn):
        """User with no concept memory returns empty list, not crash."""
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        weak = await svc.get_weak_concepts("user-1")
        assert weak == []


class TestGetRelatedConcepts:

    @patch(COLLECTION_PATH)
    async def test_get_related_concepts(self, mock_col_fn):
        """Related concepts must be filtered by domain and sorted by mastery ASC.

        WHY: The planner uses related weak concepts to suggest prerequisites.
        If sorting is wrong, the planner might prioritize reviewing the
        strongest related concept instead of the weakest.
        """
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value={
            "concepts": {
                "recursion": {
                    "concept_id": "recursion", "concept_name": "Recursion",
                    "domain": "dsa", "mastery_level": 0.3,
                    "exposure_count": 2, "last_clarity_score": 40,
                    "misconceptions": [], "first_seen": datetime.utcnow(),
                    "last_seen": datetime.utcnow(), "mastery_history": [],
                },
                "sorting": {
                    "concept_id": "sorting", "concept_name": "Sorting",
                    "domain": "dsa", "mastery_level": 0.8,
                    "exposure_count": 5, "last_clarity_score": 90,
                    "misconceptions": [], "first_seen": datetime.utcnow(),
                    "last_seen": datetime.utcnow(), "mastery_history": [],
                },
                "flask": {
                    "concept_id": "flask", "concept_name": "Flask",
                    "domain": "python", "mastery_level": 0.5,
                    "exposure_count": 3, "last_clarity_score": 60,
                    "misconceptions": [], "first_seen": datetime.utcnow(),
                    "last_seen": datetime.utcnow(), "mastery_history": [],
                },
            }
        })
        mock_col_fn.return_value = mock_col

        svc = _make_service()
        related = await svc.get_related_concepts("user-1", domain="dsa")

        assert len(related) == 2
        assert related[0].concept_id == "recursion"  # lowest mastery first
        assert related[1].concept_id == "sorting"
        # Flask (python domain) should not appear
        assert all(r.domain == "dsa" for r in related)
