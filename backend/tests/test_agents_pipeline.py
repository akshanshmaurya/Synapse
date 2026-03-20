"""
Agent Pipeline Tests — Synapse Backend
Tests the full agent pipeline with mocked LLM calls.
No external API requests occur.
"""
import json
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.agents.planner_agent import PlannerAgent
from app.agents.executor_agent import ExecutorAgent
from app.agents.evaluator_agent import EvaluatorAgent


# ---------------------------------------------------------------------------
# Planner Agent
# ---------------------------------------------------------------------------


class TestPlannerAgent:
    def setup_method(self):
        self.planner = PlannerAgent()

    def test_default_strategy_structure(self):
        """Default strategy has all required keys."""
        strategy = self.planner._default_strategy()
        assert "strategy" in strategy
        assert "tone" in strategy
        assert "focus_areas" in strategy
        assert "pacing" in strategy
        assert "verbosity" in strategy
        assert "memory_update" in strategy

    def test_default_strategy_values(self):
        """Default strategy uses safe fallback values."""
        strategy = self.planner._default_strategy()
        assert strategy["strategy"] == "support"
        assert strategy["tone"] == "warm"
        assert strategy["pacing"] == "normal"

    def test_plan_response_with_valid_llm(self, sample_user_context, mock_genai_response):
        """Planner returns parsed JSON when LLM gives valid JSON."""
        mock_json = json.dumps({
            "strategy": "teach",
            "tone": "curious",
            "focus_areas": ["python basics"],
            "should_ask_question": True,
            "detected_emotion": "neutral",
            "roadmap_relevant": False,
            "pacing": "normal",
            "verbosity": "normal",
            "max_lines": 6,
            "voice_output_required": False,
            "chat_intent": "learning python",
            "memory_update": {"new_interest": None, "new_goal": None, "struggle_detected": None},
        })
        self.planner.client = MagicMock()
        self.planner.client.models.generate_content.return_value = mock_genai_response(mock_json)

        result = self.planner.plan_response(sample_user_context, "How do I start learning Python?")
        assert result["strategy"] == "teach"
        assert result["tone"] == "curious"

    def test_plan_response_handles_invalid_json(self, sample_user_context, mock_genai_response):
        """Planner returns default strategy when LLM returns garbage."""
        self.planner.client = MagicMock()
        self.planner.client.models.generate_content.return_value = mock_genai_response("not valid json at all!")

        result = self.planner.plan_response(sample_user_context, "hello")
        assert result["strategy"] == "support"  # fallback

    def test_plan_response_handles_exception(self, sample_user_context):
        """Planner returns default strategy when LLM throws."""
        self.planner.client = MagicMock()
        self.planner.client.models.generate_content.side_effect = Exception("API failure")

        result = self.planner.plan_response(sample_user_context, "hello")
        assert result["strategy"] == "support"

    def test_plan_response_strips_code_fences(self, sample_user_context, mock_genai_response):
        """Planner correctly strips ```json fences from LLM output."""
        fenced = '```json\n{"strategy":"challenge","tone":"direct","focus_areas":[],"should_ask_question":false,"detected_emotion":"neutral","roadmap_relevant":false,"pacing":"accelerated","verbosity":"brief","max_lines":4,"voice_output_required":false,"chat_intent":"advanced topics","memory_update":{"new_interest":null,"new_goal":null,"struggle_detected":null}}\n```'
        self.planner.client = MagicMock()
        self.planner.client.models.generate_content.return_value = mock_genai_response(fenced)

        result = self.planner.plan_response(sample_user_context, "I want a challenge")
        assert result["strategy"] == "challenge"


# ---------------------------------------------------------------------------
# Executor Agent
# ---------------------------------------------------------------------------


class TestExecutorAgent:
    def setup_method(self):
        self.executor = ExecutorAgent()

    def test_generate_response_with_mock(self, sample_user_context, mock_genai_response):
        """Executor returns a string response from LLM."""
        self.executor.client = MagicMock()
        self.executor.client.models.generate_content.return_value = mock_genai_response(
            "Great question! Let me help you understand recursion step by step."
        )
        strategy = {"strategy": "teach", "tone": "warm", "verbosity": "normal", "pacing": "normal", "max_lines": 6}

        result = self.executor.generate_response(sample_user_context, "Explain recursion", strategy)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_generate_response_handles_exception(self, sample_user_context):
        """Executor returns fallback message on error."""
        self.executor.client = MagicMock()
        self.executor.client.models.generate_content.side_effect = Exception("API down")
        strategy = {"strategy": "support", "tone": "warm", "verbosity": "normal", "pacing": "normal", "max_lines": 6}

        result = self.executor.generate_response(sample_user_context, "hello", strategy)
        assert isinstance(result, str)
        assert len(result) > 0  # should return a fallback


# ---------------------------------------------------------------------------
# Evaluator Agent (fail-safe logic)
# ---------------------------------------------------------------------------


class TestEvaluatorFailSafe:
    """Tests the critical fail-safe logic that prevents clarity inflation on confusion."""

    def setup_method(self):
        self.evaluator = EvaluatorAgent()

    def _mock_evaluation(self, evaluator, result_json, mock_genai_response):
        """Helper: mock the LLM to return a specific evaluation JSON."""
        evaluator.client = MagicMock()
        evaluator.client.models.generate_content.return_value = mock_genai_response(json.dumps(result_json))

    def test_confusion_caps_clarity(self, sample_user_context, mock_genai_response):
        """If user says 'I don't understand', clarity must NOT increase."""
        prev_clarity = 55  # from sample_user_context
        llm_result = {
            "clarity_score": 75,  # LLM incorrectly increases
            "confusion_trend": "improving",
            "understanding_delta": 5,
            "reasoning": "user asked a question",
            "stagnation_flags": [],
            "engagement_level": "high",
            "struggle_detected": None,
            "struggle_severity": None,
            "positive_signals": [],
            "response_effectiveness": "effective",
            "suggested_next_focus": "continue",
            "new_interest_detected": None,
            "stage_change_recommended": None,
            "pace_adjustment": None,
        }
        self._mock_evaluation(self.evaluator, llm_result, mock_genai_response)

        result = self.evaluator.evaluate_interaction(
            "I don't understand this at all",
            "Let me explain differently...",
            sample_user_context,
        )

        # Fail-safe should cap clarity at previous value
        assert result["clarity_score"] <= prev_clarity
        assert result["understanding_delta"] <= 0
        assert result["confusion_trend"] != "improving"
        assert result["struggle_detected"] is not None

    def test_no_confusion_allows_increase(self, sample_user_context, mock_genai_response):
        """Normal message allows clarity to increase."""
        llm_result = {
            "clarity_score": 70,
            "confusion_trend": "improving",
            "understanding_delta": 5,
            "reasoning": "user paraphrased the concept correctly",
            "stagnation_flags": [],
            "engagement_level": "high",
            "struggle_detected": None,
            "struggle_severity": None,
            "positive_signals": ["correct paraphrase"],
            "response_effectiveness": "effective",
            "suggested_next_focus": "advanced topics",
            "new_interest_detected": None,
            "stage_change_recommended": None,
            "pace_adjustment": None,
        }
        self._mock_evaluation(self.evaluator, llm_result, mock_genai_response)

        result = self.evaluator.evaluate_interaction(
            "So recursion is when a function calls itself, right?",
            "Exactly! You've got it.",
            sample_user_context,
        )
        assert result["clarity_score"] == 70

    def test_default_evaluation_structure(self):
        """Default evaluation has all required keys."""
        default = self.evaluator._default_evaluation()
        required_keys = [
            "clarity_score", "confusion_trend", "understanding_delta",
            "reasoning", "stagnation_flags", "engagement_level",
            "struggle_detected", "positive_signals",
        ]
        for key in required_keys:
            assert key in default

    def test_llm_error_returns_default(self, sample_user_context):
        """LLM exception returns safe default evaluation."""
        self.evaluator.client = MagicMock()
        self.evaluator.client.models.generate_content.side_effect = Exception("API error")

        result = self.evaluator.evaluate_interaction("hello", "hi there", sample_user_context)
        assert result["clarity_score"] == 50
        assert result["confusion_trend"] == "stable"


# ---------------------------------------------------------------------------
# Evaluator: Struggle Detection
# ---------------------------------------------------------------------------


class TestStruggleDetection:
    def setup_method(self):
        self.evaluator = EvaluatorAgent()

    def test_no_struggle_in_normal_message(self):
        """Normal messages should not trigger struggle detection."""
        # Mock the LLM so it's never called
        self.evaluator.client = MagicMock()
        result = self.evaluator.detect_struggle("I learned about pandas today, it was fun!")
        assert result["is_struggle"] is False

    def test_struggle_detected_with_keyword(self, mock_genai_response):
        """Messages with struggle keywords trigger LLM analysis."""
        struggle_json = json.dumps({
            "is_struggle": True,
            "topic": "recursion",
            "severity": "moderate",
        })
        self.evaluator.client = MagicMock()
        self.evaluator.client.models.generate_content.return_value = mock_genai_response(struggle_json)

        result = self.evaluator.detect_struggle("I'm really struggling with recursion")
        assert result["is_struggle"] is True
        assert result["topic"] == "recursion"

    def test_struggle_keywords_case_insensitive(self, mock_genai_response):
        """Struggle detection is case-insensitive."""
        struggle_json = json.dumps({"is_struggle": True, "topic": "loops", "severity": "mild"})
        self.evaluator.client = MagicMock()
        self.evaluator.client.models.generate_content.return_value = mock_genai_response(struggle_json)

        result = self.evaluator.detect_struggle("I'm CONFUSED about loops")
        assert result["is_struggle"] is True
