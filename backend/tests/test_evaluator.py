"""
Evaluator Logic Tests — Synapse Backend
Focused tests on evaluator scoring invariants.
"""
import json
import pytest
from unittest.mock import MagicMock
from app.agents.evaluator_agent import EvaluatorAgent


class TestClarityScoring:
    """Verify evaluator scoring invariants."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()
        self.base_context = {
            "profile": {"stage": "intermediate", "learning_pace": "moderate"},
            "struggles": [],
            "progress": {
                "evaluation_history": [
                    {"clarity_score": 50, "confusion_trend": "stable"}
                ]
            },
        }

    def _eval_with_mock(self, user_msg, mentor_msg, llm_result, mock_factory):
        """Helper: run evaluate_interaction with mocked LLM."""
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = mock_factory(json.dumps(llm_result))
        return self.evaluator.evaluate_interaction(user_msg, mentor_msg, self.base_context)

    def test_correct_explanation_allows_increase(self, mock_genai_response):
        """User correctly paraphrasing increases clarity."""
        result = self._eval_with_mock(
            "So a list comprehension creates a new list by applying an expression to each item?",
            "Exactly right!",
            {"clarity_score": 65, "confusion_trend": "improving", "understanding_delta": 5,
             "reasoning": "correct paraphrase", "stagnation_flags": [], "engagement_level": "high",
             "struggle_detected": None, "struggle_severity": None, "positive_signals": ["paraphrase"],
             "response_effectiveness": "effective", "suggested_next_focus": "generators",
             "new_interest_detected": None, "stage_change_recommended": None, "pace_adjustment": None},
            mock_genai_response,
        )
        assert result["clarity_score"] == 65

    def test_confused_response_blocks_increase(self, mock_genai_response):
        """'I don't get it' must NOT increase clarity."""
        result = self._eval_with_mock(
            "I don't get it, what is a decorator?",
            "A decorator wraps another function...",
            {"clarity_score": 70, "confusion_trend": "improving", "understanding_delta": 5,
             "reasoning": "exploring", "stagnation_flags": [], "engagement_level": "medium",
             "struggle_detected": None, "struggle_severity": None, "positive_signals": [],
             "response_effectiveness": "neutral", "suggested_next_focus": "decorators",
             "new_interest_detected": None, "stage_change_recommended": None, "pace_adjustment": None},
            mock_genai_response,
        )
        assert result["clarity_score"] <= 50  # capped at prev
        assert result["understanding_delta"] <= 0

    def test_im_confused_triggers_failsafe(self, mock_genai_response):
        """'I'm confused' activates the fail-safe."""
        result = self._eval_with_mock(
            "I'm confused about all of this",
            "Let me clarify...",
            {"clarity_score": 60, "confusion_trend": "improving", "understanding_delta": 3,
             "reasoning": "exploring", "stagnation_flags": [], "engagement_level": "medium",
             "struggle_detected": None, "struggle_severity": None, "positive_signals": [],
             "response_effectiveness": "neutral", "suggested_next_focus": "basics",
             "new_interest_detected": None, "stage_change_recommended": None, "pace_adjustment": None},
            mock_genai_response,
        )
        assert result["confusion_trend"] != "improving"
        assert result["struggle_detected"] is not None

    def test_stagnation_detection(self, mock_genai_response):
        """Stagnation flags are preserved from LLM output."""
        result = self._eval_with_mock(
            "tell me again about OOP",
            "Object-oriented programming is...",
            {"clarity_score": 48, "confusion_trend": "stable", "understanding_delta": -2,
             "reasoning": "repeating same topic", "stagnation_flags": ["OOP", "classes"],
             "engagement_level": "low", "struggle_detected": "OOP", "struggle_severity": "moderate",
             "positive_signals": [], "response_effectiveness": "needs_adjustment",
             "suggested_next_focus": "practical OOP exercises",
             "new_interest_detected": None, "stage_change_recommended": None, "pace_adjustment": "slow_down"},
            mock_genai_response,
        )
        assert "OOP" in result["stagnation_flags"]
        assert result["pace_adjustment"] == "slow_down"


class TestRoadmapFeedbackAnalysis:
    """Test evaluator's roadmap feedback analysis."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()

    def test_empty_feedback_returns_none_action(self):
        """No feedback = no action needed."""
        result = self.evaluator.analyze_roadmap_feedback([], {})
        assert result["action"] == "none"

    def test_stuck_feedback_with_mock(self, mock_genai_response):
        """Stuck feedback triggers analysis."""
        feedback = [
            {"feedback_type": "stuck", "message": "Can't understand step 3"},
            {"feedback_type": "stuck", "message": "Step 5 is too hard"},
        ]
        analysis_json = json.dumps({
            "action": "simplify",
            "new_learning_pace": "slow",
            "difficulty_areas": ["data structures"],
            "recommendations": ["add more examples"],
            "should_simplify": True,
        })
        self.evaluator.model = MagicMock()
        self.evaluator.model.generate_content.return_value = mock_genai_response(analysis_json)

        result = self.evaluator.analyze_roadmap_feedback(feedback, {"profile": {"learning_pace": "moderate"}})
        assert result["action"] == "simplify"
        assert result["should_simplify"] is True
