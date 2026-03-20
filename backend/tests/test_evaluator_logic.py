"""
Evaluator Logic Tests
Consolidated tests to verify evaluating bounds, edge cases, and roadmap feedback.
Redundant LLM mock variations have been removed.
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
# Strict Constraints & Bounds
# ---------------------------------------------------------------------------

class TestEvaluatorConstraints:
    def setup_method(self):
        self.evaluator = EvaluatorAgent()

    @pytest.mark.parametrize("confusion_marker", ["I don't understand", "I'm lost"])
    def test_confusion_failsafe_caps_clarity(self, confusion_marker):
        """Proof that the Python fail-safe overrides an LLM hallucinating clarity on confused inputs."""
        prev = 50
        ctx = _base_context(prev)
        # LLM tries to wrongly increase clarity
        llm = _llm_result(clarity_score=80, understanding_delta=10, confusion_trend="improving")
        self.evaluator.client = MagicMock()
        self.evaluator.client.models.generate_content.return_value = _mock_response(json.dumps(llm))

        result = self.evaluator.evaluate_interaction(confusion_marker, "Let me explain", ctx)
        
        assert result["clarity_score"] <= prev
        assert result["understanding_delta"] <= 0
        assert result["confusion_trend"] != "improving"
        assert result["struggle_detected"] is not None

    def test_clarity_score_bounds_recovery(self):
        """Negative or out of bounds clarity from LLM doesn't crash."""
        ctx = _base_context(50)
        llm = _llm_result(clarity_score=-500)
        self.evaluator.client = MagicMock()
        self.evaluator.client.models.generate_content.return_value = _mock_response(json.dumps(llm))

        result = self.evaluator.evaluate_interaction("hello", "hi", ctx)
        assert isinstance(result["clarity_score"], (int, float))

    def test_malformed_json_fallback(self):
        """Malformed JSON LLM output safely defaults."""
        self.evaluator.client = MagicMock()
        self.evaluator.client.models.generate_content.return_value = _mock_response("I am an LLM, here is text, not json")
        result = self.evaluator.evaluate_interaction("hello", "hi", _base_context(50))
        assert result["clarity_score"] == 50
        assert result["confusion_trend"] == "stable"


# ---------------------------------------------------------------------------
# Roadmap Feedback Analysis
# ---------------------------------------------------------------------------

class TestRoadmapFeedbackAnalysis:
    def setup_method(self):
        self.evaluator = EvaluatorAgent()

    def test_empty_feedback_returns_none_action(self):
        result = self.evaluator.analyze_roadmap_feedback([], {})
        assert result["action"] == "none"

    def test_stuck_feedback_with_mock(self):
        feedback = [
            {"feedback_type": "stuck", "message": "Can't understand step 3"},
        ]
        analysis_json = json.dumps({
            "action": "simplify",
            "new_learning_pace": "slow",
            "difficulty_areas": ["data structures"],
            "recommendations": ["add more examples"],
            "should_simplify": True,
        })
        self.evaluator.client = MagicMock()
        self.evaluator.client.models.generate_content.return_value = _mock_response(analysis_json)

        result = self.evaluator.analyze_roadmap_feedback(feedback, {"profile": {"learning_pace": "moderate"}})
        assert result["action"] == "simplify"
        assert result["should_simplify"] is True
