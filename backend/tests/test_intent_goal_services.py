import pytest
from unittest.mock import MagicMock, patch
from app.services.intent_classifier_service import IntentClassifierService, IntentResult, ProfileSignals
from app.services.goal_inference_service import GoalInferenceService, GoalInferenceResult
from app.models.memory_v2 import SessionContext

# --- IntentClassifierService Tests ---

def test_intent_classifier_heuristic_unknown():
    service = IntentClassifierService()
    # Message count <= 2 should return "unknown"
    result = service.classify("Explain recursion", 1, [])
    print(f"DEBUG: classify result={result}")
    assert result.intent == "unknown"
    assert result.method == "heuristic"

def test_intent_classifier_keyword_learning():
    service = IntentClassifierService()
    # Message count > 2 and contains learning keywords
    result = service.classify("Explain recursion to me", 3, ["Hi", "Hello"])
    print(f"DEBUG: classify result={result}")
    assert result.intent == "learning"
    assert result.method == "keyword"

def test_intent_classifier_keyword_casual():
    service = IntentClassifierService()
    result = service.classify("How are you today?", 3, ["Hi", "Hello"])
    assert result.intent == "casual"
    assert result.method == "keyword"

@patch("app.services.intent_classifier_service.generate_with_retry")
def test_intent_classifier_llm_fallback(mock_generate):
    # Mock LLM response
    mock_resp = MagicMock()
    mock_resp.text = '{"intent": "problem_solving", "confidence": 0.9, "reasoning": "User wants to fix a bug"}'
    mock_generate.return_value = mock_resp

    service = IntentClassifierService()
    # No keywords, msg_count > 2
    result = service.classify("The weather is nice today", 3, ["Hi", "Hello"])
    
    assert result.intent == "problem_solving"
    assert result.method == "llm"

def test_intent_should_reclassify():
    service = IntentClassifierService()
    ctx = SessionContext(session_id="s1", user_id="u1", message_count=2, session_intent="unknown")
    
    # unknown -> reclassify at msg_count >= 2
    assert service.should_reclassify(ctx, "hello") is True
    
    # casual -> reclassify if learning keyword found
    ctx.session_intent = "casual"
    ctx.message_count = 5
    assert service.should_reclassify(ctx, "explain recursion") is True
    assert service.should_reclassify(ctx, "just chatting") is False

def test_extract_profile_signals():
    service = IntentClassifierService()
    signals = service.extract_profile_signals(
        "I am working on a recursion problem in Python for my internship interview", 
        []
    )
    assert "python" in signals.detected_interests
    assert "preparing for placement" in signals.implicit_goals
    assert signals.vocabulary_level == "intermediate"

# --- GoalInferenceService Tests ---

def test_goal_inference_should_infer():
    service = GoalInferenceService()
    ctx = SessionContext(session_id="s1", user_id="u1", message_count=2, session_goal=None)
    
    # msg_count == 2 and no goal
    print(f"DEBUG: ctx.message_count={ctx.message_count}")
    assert service.should_infer(ctx) is True
    
    # already has goal
    ctx.session_goal = "Learn Python"
    assert service.should_infer(ctx) is False
    
    # casual intent should NOT infer
    ctx.session_goal = None
    ctx.session_intent = "casual"
    assert service.should_infer(ctx) is False

@patch("app.services.goal_inference_service.generate_with_retry")
def test_infer_goal_llm(mock_generate):
    mock_resp = MagicMock()
    mock_resp.text = '"Understand how binary search trees work"'
    mock_generate.return_value = mock_resp

    service = GoalInferenceService()
    result = service.infer_goal(["What is a BST?", "How do I insert?"], "dsa")
    
    assert result.inferred_goal == "Understand how binary search trees work"
    assert result.inferred_domain == "dsa"
    assert result.confidence == 0.8
