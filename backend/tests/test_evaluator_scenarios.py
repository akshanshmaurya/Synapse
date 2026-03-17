"""
Evaluator Scenario Runner — Phase 3
Loads JSON scenarios from tests/evaluator_cases/ and validates
evaluator output against expected constraints.
All LLM calls are mocked.
"""
import json
import os
import pytest
from pathlib import Path
from unittest.mock import MagicMock
from app.agents.evaluator_agent import EvaluatorAgent

CASES_DIR = Path(__file__).parent / "evaluator_cases"


def _load_case(name: str) -> dict:
    """Load a JSON scenario file."""
    with open(CASES_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def _make_mock_response(text: str):
    """Create a mock genai response."""
    m = MagicMock()
    m.text = text
    return m


def _build_context(prev_clarity: int = 50, prev_trend: str = "stable") -> dict:
    """Build a sample user context with a given previous clarity score."""
    return {
        "profile": {"stage": "intermediate", "learning_pace": "moderate"},
        "struggles": [],
        "progress": {
            "evaluation_history": [
                {"clarity_score": prev_clarity, "confusion_trend": prev_trend}
            ]
        },
        "onboarding": {"mentoring_style": "supportive"},
    }


def _make_llm_result(**overrides) -> dict:
    """Build a standard evaluator LLM result with overrides."""
    base = {
        "clarity_score": 50,
        "confusion_trend": "stable",
        "understanding_delta": 0,
        "reasoning": "analysis",
        "stagnation_flags": [],
        "engagement_level": "medium",
        "struggle_detected": None,
        "struggle_severity": None,
        "positive_signals": [],
        "response_effectiveness": "neutral",
        "suggested_next_focus": "continue",
        "new_interest_detected": None,
        "stage_change_recommended": None,
        "pace_adjustment": None,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Step 1 & 2: Scenario-based tests
# ---------------------------------------------------------------------------


class TestConfusionScenario:
    """Confusion case: user explicitly confused → clarity must NOT increase."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()
        self.case = _load_case("confusion_case.json")

    def test_scenario_loads(self):
        """JSON scenario loads correctly."""
        assert self.case["case"] == "explicit_confusion"
        assert len(self.case["steps"]) == 2

    def test_confusion_blocks_clarity_increase(self):
        """When LLM incorrectly increases clarity on confused message, fail-safe caps it."""
        prev_clarity = 50
        ctx = _build_context(prev_clarity)
        step = self.case["steps"][1]

        # LLM tries to increase clarity (wrong) — fail-safe should fix it
        llm_result = _make_llm_result(clarity_score=75, confusion_trend="improving", understanding_delta=5)
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _make_mock_response(json.dumps(llm_result))

        result = self.evaluator.evaluate_interaction(step["user"], step["assistant"], ctx)
        assert result["clarity_score"] <= prev_clarity
        assert result["understanding_delta"] <= 0
        assert result["confusion_trend"] != "improving"
        assert result["struggle_detected"] is not None

    def test_confusion_preserves_lower_score(self):
        """If LLM gives a LOWER score during confusion, fail-safe doesn't interfere."""
        prev_clarity = 50
        ctx = _build_context(prev_clarity)
        step = self.case["steps"][1]

        llm_result = _make_llm_result(clarity_score=35, confusion_trend="worsening", understanding_delta=-5)
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _make_mock_response(json.dumps(llm_result))

        result = self.evaluator.evaluate_interaction(step["user"], step["assistant"], ctx)
        assert result["clarity_score"] == 35  # preserved, not capped up


class TestParaphrasingScenario:
    """Paraphrasing case: user correctly explains concept → positive signals."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()
        self.case = _load_case("paraphrasing_success.json")

    def test_correct_paraphrase_allows_increase(self):
        """When user paraphrases correctly, clarity increase is allowed."""
        ctx = _build_context(50)
        step = self.case["steps"][1]

        llm_result = _make_llm_result(
            clarity_score=70,
            confusion_trend="improving",
            understanding_delta=8,
            positive_signals=["correct paraphrase", "applied analogy"],
        )
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _make_mock_response(json.dumps(llm_result))

        result = self.evaluator.evaluate_interaction(step["user"], step["assistant"], ctx)
        assert result["clarity_score"] == 70  # increase allowed
        assert result["understanding_delta"] > 0
        assert len(result["positive_signals"]) > 0


class TestStagnationScenario:
    """Stagnation case: repeated same question → stagnation expected."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()
        self.case = _load_case("stagnation_case.json")

    def test_repeated_topic_triggers_stagnation(self):
        """3rd repetition of same topic should flag stagnation."""
        ctx = _build_context(45)
        step = self.case["steps"][2]

        llm_result = _make_llm_result(
            clarity_score=42,
            confusion_trend="stable",
            understanding_delta=-1,
            stagnation_flags=["decorators"],
            engagement_level="low",
            response_effectiveness="needs_adjustment",
            pace_adjustment="slow_down",
        )
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _make_mock_response(json.dumps(llm_result))

        result = self.evaluator.evaluate_interaction(step["user"], step["assistant"], ctx)
        assert len(result["stagnation_flags"]) > 0
        assert result["engagement_level"] in ("low", "medium")


class TestLearningProgressionScenario:
    """Full learning arc: confused → explained → paraphrased."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()
        self.case = _load_case("learning_progression.json")

    def test_step1_confusion_detected(self):
        """Step 1: User says 'I'm confused' → fail-safe activates."""
        ctx = _build_context(50)
        step = self.case["steps"][0]

        llm_result = _make_llm_result(clarity_score=60, understanding_delta=3, confusion_trend="improving")
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _make_mock_response(json.dumps(llm_result))

        result = self.evaluator.evaluate_interaction(step["user"], step["assistant"], ctx)
        # "I'm confused" triggers fail-safe
        assert result["clarity_score"] <= 50
        assert result["understanding_delta"] <= 0

    def test_step3_paraphrase_recognized(self):
        """Step 3: User correctly paraphrases → increase allowed."""
        ctx = _build_context(45)
        step = self.case["steps"][2]

        llm_result = _make_llm_result(
            clarity_score=72,
            understanding_delta=10,
            confusion_trend="improving",
            positive_signals=["correct explanation", "O(1) insight"],
        )
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _make_mock_response(json.dumps(llm_result))

        result = self.evaluator.evaluate_interaction(step["user"], step["assistant"], ctx)
        assert result["clarity_score"] == 72
        assert result["understanding_delta"] > 0


class TestPartialUnderstandingScenario:
    """Partial understanding: mixed signals expected."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()
        self.case = _load_case("partial_understanding.json")

    def test_partial_gives_moderate_scores(self):
        """Partial understanding should produce moderate scores."""
        ctx = _build_context(50)
        step = self.case["steps"][1]

        llm_result = _make_llm_result(
            clarity_score=55,
            confusion_trend="stable",
            understanding_delta=2,
            struggle_detected="async/await pausing semantics",
            struggle_severity="mild",
        )
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _make_mock_response(json.dumps(llm_result))

        result = self.evaluator.evaluate_interaction(step["user"], step["assistant"], ctx)
        assert 30 <= result["clarity_score"] <= 70
        assert result["confusion_trend"] in ("stable", "improving", "worsening")
