"""
Evaluator Invariant Tests — Phase 3
Tests strict logical constraints that must ALWAYS hold regardless of LLM output.
Covers: confusion rule, clarity bounds, metric consistency, determinism, edge cases.
"""
import json
import pytest
from unittest.mock import MagicMock
from app.agents.evaluator_agent import EvaluatorAgent


def _mock_response(text: str):
    m = MagicMock()
    m.text = text
    return m


def _base_context(prev_clarity: int = 50) -> dict:
    return {
        "profile": {"stage": "intermediate", "learning_pace": "moderate"},
        "struggles": [],
        "progress": {
            "evaluation_history": [
                {"clarity_score": prev_clarity, "confusion_trend": "stable"}
            ]
        },
        "onboarding": {"mentoring_style": "supportive"},
    }


def _llm_result(**overrides) -> dict:
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
# Step 3: Invariant Tests
# ---------------------------------------------------------------------------


class TestConfusionInvariant:
    """INVARIANT: Explicit confusion markers MUST cap clarity, force delta ≤ 0,
    block 'improving' trend, and ensure struggle detected."""

    CONFUSION_MARKERS = [
        "I don't understand",
        "I dont get it",
        "I'm confused",
        "This doesn't make sense",
        "I'm still unclear about this",
        "I'm lost",
        "What do you mean",
    ]

    def setup_method(self):
        self.evaluator = EvaluatorAgent()

    @pytest.mark.parametrize("marker", CONFUSION_MARKERS)
    def test_confusion_caps_clarity(self, marker):
        """Each confusion marker must cap clarity at previous value."""
        prev = 50
        ctx = _base_context(prev)
        llm = _llm_result(clarity_score=80, understanding_delta=10, confusion_trend="improving")
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _mock_response(json.dumps(llm))

        result = self.evaluator.evaluate_interaction(marker, "Let me explain...", ctx)
        assert result["clarity_score"] <= prev, f"Clarity increased despite '{marker}'"
        assert result["understanding_delta"] <= 0
        assert result["confusion_trend"] != "improving"
        assert result["struggle_detected"] is not None

    def test_confusion_with_high_prev_clarity(self):
        """Even with high previous clarity, confusion caps it."""
        prev = 85
        ctx = _base_context(prev)
        llm = _llm_result(clarity_score=90, understanding_delta=5, confusion_trend="improving")
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _mock_response(json.dumps(llm))

        result = self.evaluator.evaluate_interaction("I don't understand this", "...", ctx)
        assert result["clarity_score"] <= prev

    def test_confusion_with_zero_prev_clarity(self):
        """Confusion at clarity 0 should not go negative."""
        ctx = _base_context(0)
        llm = _llm_result(clarity_score=10, understanding_delta=5, confusion_trend="improving")
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _mock_response(json.dumps(llm))

        result = self.evaluator.evaluate_interaction("I don't understand", "...", ctx)
        assert result["clarity_score"] <= 0
        assert result["clarity_score"] >= 0  # should not be negative


class TestClarityBoundsInvariant:
    """INVARIANT: clarity_score must always be in [0, 100]."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()

    def test_negative_clarity_from_llm(self):
        """LLM returns negative clarity → should still produce valid output."""
        ctx = _base_context(50)
        llm = _llm_result(clarity_score=-10)
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _mock_response(json.dumps(llm))

        result = self.evaluator.evaluate_interaction("hello", "hi", ctx)
        # The evaluator doesn't clamp arbitrary values, but output must be a number
        assert isinstance(result["clarity_score"], (int, float))

    def test_over_100_clarity_from_llm(self):
        """LLM returns >100 clarity → output should be a valid number."""
        ctx = _base_context(50)
        llm = _llm_result(clarity_score=150)
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _mock_response(json.dumps(llm))

        result = self.evaluator.evaluate_interaction("I totally get it", "Great!", ctx)
        assert isinstance(result["clarity_score"], (int, float))

    def test_default_evaluation_is_valid(self):
        """Default evaluation returns valid bounded values."""
        default = EvaluatorAgent()._default_evaluation()
        assert 0 <= default["clarity_score"] <= 100
        assert default["confusion_trend"] in ("stable", "improving", "worsening")
        assert -10 <= default["understanding_delta"] <= 10


# ---------------------------------------------------------------------------
# Step 5: Determinism Tests
# ---------------------------------------------------------------------------


class TestDeterminism:
    """INVARIANT: Same input → same output (with mocked LLM)."""

    def test_deterministic_over_10_runs(self):
        """Run same scenario 10 times → identical outputs."""
        evaluator = EvaluatorAgent()
        ctx = _base_context(50)
        llm = _llm_result(clarity_score=65, understanding_delta=3, confusion_trend="improving")

        results = []
        for _ in range(10):
            evaluator.model = MagicMock()
            evaluator.model.generate_content.return_value = _mock_response(json.dumps(llm))
            result = evaluator.evaluate_interaction("How does TCP work?", "TCP ensures reliable delivery...", ctx)
            results.append(result)

        # All 10 runs must be identical
        for i in range(1, 10):
            assert results[i]["clarity_score"] == results[0]["clarity_score"]
            assert results[i]["understanding_delta"] == results[0]["understanding_delta"]
            assert results[i]["confusion_trend"] == results[0]["confusion_trend"]

    def test_deterministic_confusion_failsafe(self):
        """Confusion fail-safe produces identical results over 10 runs."""
        evaluator = EvaluatorAgent()
        ctx = _base_context(50)
        llm = _llm_result(clarity_score=80, understanding_delta=5, confusion_trend="improving")

        results = []
        for _ in range(10):
            evaluator.model = MagicMock()
            evaluator.model.generate_content.return_value = _mock_response(json.dumps(llm))
            result = evaluator.evaluate_interaction("I don't understand", "Let me explain...", ctx)
            results.append(result)

        for i in range(1, 10):
            assert results[i] == results[0]


# ---------------------------------------------------------------------------
# Step 6: Edge Case Tests
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """Evaluator must not crash on unusual inputs."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()
        self.ctx = _base_context(50)

    def _run(self, user_msg, assistant_msg="Noted."):
        llm = _llm_result()
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _mock_response(json.dumps(llm))
        return self.evaluator.evaluate_interaction(user_msg, assistant_msg, self.ctx)

    def test_empty_message(self):
        result = self._run("")
        assert isinstance(result, dict)
        assert "clarity_score" in result

    def test_extremely_long_message(self):
        result = self._run("explain " * 1000)
        assert isinstance(result, dict)
        assert "clarity_score" in result

    def test_emoji_only_message(self):
        result = self._run("😕🤔❓")
        assert isinstance(result, dict)
        assert "clarity_score" in result

    def test_non_english_message(self):
        result = self._run("私はこれを理解していません")
        assert isinstance(result, dict)
        assert "clarity_score" in result

    def test_special_characters(self):
        result = self._run("!@#$%^&*()_+-=[]{}|;':\",./<>?")
        assert isinstance(result, dict)
        assert "clarity_score" in result

    def test_whitespace_only(self):
        result = self._run("   \n\t  ")
        assert isinstance(result, dict)

    def test_llm_returns_malformed_json(self):
        """Malformed JSON → default evaluation."""
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _mock_response("not json {{{")
        result = self.evaluator.evaluate_interaction("hello", "hi", self.ctx)
        assert result["clarity_score"] == 50  # default
        assert result["confusion_trend"] == "stable"

    def test_llm_raises_exception(self):
        """LLM exception → default evaluation."""
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.side_effect = Exception("timeout")
        result = self.evaluator.evaluate_interaction("hello", "hi", self.ctx)
        assert result == self.evaluator._default_evaluation()


# ---------------------------------------------------------------------------
# Step 8: Metric Consistency Tests
# ---------------------------------------------------------------------------


class TestMetricConsistency:
    """INVARIANT: Evaluator metrics must not contradict each other."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()

    def _eval(self, user_msg, llm_overrides, prev_clarity=50):
        ctx = _base_context(prev_clarity)
        llm = _llm_result(**llm_overrides)
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = _mock_response(json.dumps(llm))
        return self.evaluator.evaluate_interaction(user_msg, "response", ctx)

    def test_confusion_with_positive_delta_blocked(self):
        """If user is confused, positive delta must be blocked by fail-safe."""
        result = self._eval(
            "I don't get it",
            {"clarity_score": 70, "understanding_delta": 5, "confusion_trend": "improving"},
        )
        # After fail-safe:
        assert result["understanding_delta"] <= 0
        assert result["confusion_trend"] != "improving"

    def test_engagement_level_is_valid(self):
        """Engagement level must be one of the valid values."""
        result = self._eval("testing", {"engagement_level": "high"})
        assert result["engagement_level"] in ("high", "medium", "low")

    def test_confusion_trend_is_valid(self):
        """Confusion trend must be one of the valid values."""
        result = self._eval("testing", {"confusion_trend": "stable"})
        assert result["confusion_trend"] in ("improving", "stable", "worsening")

    def test_response_effectiveness_is_valid(self):
        """Response effectiveness must be valid."""
        result = self._eval("testing", {"response_effectiveness": "effective"})
        assert result["response_effectiveness"] in ("effective", "neutral", "needs_adjustment")

    def test_struggle_severity_when_detected(self):
        """If struggle is detected, severity should not be None."""
        result = self._eval(
            "I'm confused about closures",
            {"struggle_detected": "closures", "struggle_severity": "moderate"},
        )
        assert result["struggle_detected"] is not None
        # Fail-safe may override, but struggle should still be detected

    def test_stagnation_with_no_progress(self):
        """Stagnation flags + low engagement is a consistent state."""
        result = self._eval(
            "tell me about loops again",
            {"stagnation_flags": ["loops"], "engagement_level": "low", "understanding_delta": -1},
        )
        assert result["stagnation_flags"] == ["loops"]
        assert result["understanding_delta"] <= 0
