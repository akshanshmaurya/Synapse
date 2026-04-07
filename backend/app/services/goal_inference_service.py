"""
Goal Inference Service
Infers a learning goal from the user's initial messages if none is explicitly set.
"""
import logging
from dataclasses import dataclass
from typing import List, Optional

from google import genai
from app.core.config import settings
from app.services.llm_utils import generate_with_retry
from app.models.memory_v2 import SessionContext
from app.services.intent_classifier_service import INTEREST_DOMAINS

logger = logging.getLogger(__name__)

GOAL_TYPE_SIGNALS = {
    "interview_prep": ["interview", "placement", "company", "leetcode", "crack"],
    "problem_solving": ["fix", "bug", "error", "build", "create", "implement", "write"],
    "concept_learning": ["explain", "understand", "learn", "how does", "what is", "why"],
    "project_building": ["project", "app", "website", "system", "build something"],
}

@dataclass
class GoalInferenceResult:
    inferred_goal: str
    inferred_domain: str
    confidence: float
    goal_type: str

class GoalInferenceService:
    """Infers a learning goal from the user's initial messages when none is explicitly set.

    Uses a three-step pipeline:
        1. Deterministic domain detection via keyword matching
        2. Deterministic goal-type classification (interview_prep, concept_learning, etc.)
        3. Single LLM pass to generate a concise, specific goal sentence

    Triggered exactly once per session at message_count == 3 (via should_infer()).
    """

    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model_name = settings.GEMINI_MODEL

    def infer_goal(self, session_history: List[str], session_domain: Optional[str]) -> GoalInferenceResult:
        """
        Infers a specific learning goal using deterministic heuristic filtering followed by a single LLM pass.
        Runs exactly at message_count == 3.
        """
        combined_messages = " ".join(session_history).lower()

        # Step 1: Fast domain detection (deterministic)
        domain_counts = {}
        for domain, keywords in INTEREST_DOMAINS.items():
            count = sum(1 for kw in keywords if kw in combined_messages)
            if count > 0:
                domain_counts[domain] = count

        if domain_counts:
            top_domain = max(domain_counts, key=domain_counts.get)
            if domain_counts[top_domain] >= 2:
                inferred_domain = top_domain
            else:
                inferred_domain = "unknown"
        else:
            inferred_domain = "unknown"

        # Force override from session_domain if provided
        if inferred_domain == "unknown" and session_domain:
            inferred_domain = session_domain

        # Step 2: Fast goal_type detection (deterministic)
        type_counts = {}
        for gtype, signals in GOAL_TYPE_SIGNALS.items():
            count = sum(1 for sig in signals if sig in combined_messages)
            if count > 0:
                type_counts[gtype] = count

        if type_counts:
            # Check for max
            top_type = max(type_counts, key=type_counts.get)
            # In case of tie, just pick the top one as returned by max (first inserted typically)
            # or default to concept_learning if zero.
            goal_type = top_type
        else:
            goal_type = "concept_learning"

        # Step 3: LLM inference
        formatted_history = "\n".join([f"- {msg}" for msg in session_history])
        
        prompt = f"""A user has started a mentoring session. Based on their first few messages,
infer a clear, specific learning goal.
User messages:
{formatted_history}
Domain hint: {inferred_domain or "unknown"}
Goal type hint: {goal_type}
Write a single clear goal sentence (max 10 words, starts with a verb):
Examples:

"Learn how binary search trees work"
"Fix the authentication bug in my FastAPI app"
"Prepare for DSA coding interviews"
"Understand the difference between async and threading"

Reply with ONLY the goal string. No explanation. No punctuation at the end."""

        confidence = 0.4
        inferred_goal_string = ""
        llm_responded = False

        try:
            response = generate_with_retry(
                client=self.client,
                model=self.model_name,
                contents=prompt
            )
            if response and response.text:
                text = response.text.replace('"', '').strip()
                # Remove trailing punctuation
                if text and text[-1] in ".!?":
                    text = text[:-1]
                    
                words = text.split()
                if 0 < len(words) <= 15:
                    inferred_goal_string = text
                    llm_responded = True
        except Exception as e:
            logger.warning(f"Goal inference LLM pass failed: {e}")

        # Evaluate Confidence & Fallback
        if not llm_responded:
            inferred_goal_string = f"Explore {inferred_domain} concepts" if inferred_domain != "unknown" else "Learn something new"

        if inferred_domain != "unknown" and goal_type and llm_responded:
            confidence = 0.8
        elif inferred_domain != "unknown" and not llm_responded:
            confidence = 0.6
        elif inferred_domain == "unknown":
            confidence = 0.5
        elif not llm_responded:
            confidence = 0.4

        result = GoalInferenceResult(
            inferred_goal=inferred_goal_string,
            inferred_domain=inferred_domain,
            confidence=confidence,
            goal_type=goal_type
        )
        logger.info(f"Goal inferred: '{result.inferred_goal}' (confidence: {result.confidence})")
        return result

    def should_infer(self, session_context: SessionContext) -> bool:
        """
        Determines if we should run goal inference.
        True if msg_count == 3, goal is None, intent is learning/problem_solving/unknown.
        """
        if session_context.goal_confirmed or session_context.goal_inferred or session_context.session_goal is not None:
            return False
            
        intent = getattr(session_context, 'session_intent', 'unknown')
        if intent == "casual":
            return False
            
        if session_context.message_count == 2 and intent in ("learning", "problem_solving", "unknown"):
            logger.debug(f"Goal inference triggered at message_count={session_context.message_count} for intent={intent}")
            return True
            
        return False

goal_inference_service = GoalInferenceService()
