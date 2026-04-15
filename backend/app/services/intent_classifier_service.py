"""Classifies chat messages into learning intents to control evaluator behavior.

By distinguishing between learning, problem-solving, and casual conversation, this
module ensures that mastery scores are only updated when a genuine learning
interaction occurs, preventing casual chatter from corrupting cognitive data.
"""
import logging
import json
from dataclasses import dataclass
from typing import List, Optional

from google import genai
from app.core.config import settings
from app.services.llm_utils import generate_with_retry, strip_json_fences
from app.models.memory_v2 import SessionContext

logger = logging.getLogger(__name__)

LEARNING_KEYWORDS = {
    "explain", "understand", "learn", "how does", "what is", "why does",
    "difference between", "concept", "teach me", "i dont understand",
    "confused about", "clarify", "what are", "how do i", "walk me through",
    "study", "prepare for", "master", "theory behind", "fundamentals"
}

PROBLEM_SOLVING_KEYWORDS = {
    "fix", "bug", "error", "not working", "help me with", "write a",
    "create a", "build", "implement", "generate", "code for", "script",
    "how to make", "debug", "issue with", "failing", "broken", "solve"
}

REVIEW_KEYWORDS = {
    "remind me", "recap", "summary of", "revisit", "refresh", "forgot",
    "remember when", "we covered", "last time", "previously", "again",
    "review", "go over again"
}

CASUAL_KEYWORDS = {
    "how are you", "what do you think", "tell me about yourself",
    "whats up", "just chatting", "bored", "recommend", "opinion",
    "do you like", "favorite", "fun fact", "joke", "what should i"
}

INTEREST_DOMAINS = {
    "dsa": ["array", "tree", "graph", "linked list", "recursion", "dp", "leetcode", "algorithm"],
    "python": ["python", "django", "fastapi", "pandas", "numpy", "flask"],
    "web": ["react", "css", "html", "javascript", "frontend", "backend", "api"],
    "ml": ["machine learning", "model", "neural", "dataset", "training", "tensorflow"],
    "career": ["internship", "job", "interview", "resume", "company", "placement"],
    "system_design": ["scalability", "database", "microservice", "architecture", "distributed"]
}

@dataclass
class IntentResult:
    intent: str
    confidence: float
    method: str
    reasoning: str

@dataclass
class ProfileSignals:
    detected_interests: List[str]
    vocabulary_level: str
    communication_style: str
    implicit_goals: List[str]
    confidence: float

class IntentClassifierService:
    """Classifies chat messages into learning intents to control evaluator behavior.

    Uses a three-tier classification pipeline:
        1. Heuristic guard (skip if < 3 messages)
        2. Deterministic keyword matching against curated domain vocabularies
        3. LLM fallback for ambiguous messages

    Also extracts soft profile signals (interests, goals, vocabulary level)
    from user messages without LLM calls.
    """

    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model_name = settings.GEMINI_MODEL

    def classify(self, message: str, message_count: int, session_history: List[str]) -> IntentResult:
        """Classify the intent of a message in a tutoring/mentorship context.

        Args:
            message: The raw text input from the user.
            message_count: The current position in the conversation to trigger heuristics.
            session_history: List of previous message strings for contextual LLM analysis.

        Returns:
            IntentResult containing the detected intent, confidence score, and method used.
        """
        # Step 1: Heuristic pass
        if message_count < 3:
            return IntentResult(
                intent="unknown",
                confidence=1.0,
                method="heuristic",
                reasoning="insufficient messages for classification"
            )
        
        # Step 2: Deterministic keyword pass
        msg_lower = message.lower()
        
        matches = {}
        if any(kw in msg_lower for kw in LEARNING_KEYWORDS):
            matches["learning"] = sum(1 for kw in LEARNING_KEYWORDS if kw in msg_lower)
        if any(kw in msg_lower for kw in PROBLEM_SOLVING_KEYWORDS):
            matches["problem_solving"] = sum(1 for kw in PROBLEM_SOLVING_KEYWORDS if kw in msg_lower)
        if any(kw in msg_lower for kw in REVIEW_KEYWORDS):
            matches["review"] = sum(1 for kw in REVIEW_KEYWORDS if kw in msg_lower)
        if any(kw in msg_lower for kw in CASUAL_KEYWORDS):
            matches["casual"] = sum(1 for kw in CASUAL_KEYWORDS if kw in msg_lower)
            
        if len(matches) == 1:
            intent = list(matches.keys())[0]
            result = IntentResult(intent=intent, confidence=0.85, method="keyword", reasoning=f"matched {intent} keyword")
            logger.debug(f"Intent classified: {result.intent} (method: {result.method})")
            return result
        elif len(matches) > 1:
            intent = max(matches, key=matches.get)
            result = IntentResult(intent=intent, confidence=0.7, method="keyword", reasoning=f"multiple matches, defaulted to {intent} with most keywords")
            logger.debug(f"Intent classified: {result.intent} (method: {result.method})")
            return result

        # Step 3: LLM classification pass
        prompt = f"""Classify the intent of this message in a tutoring/mentorship context.
Message: "{message}"
Context: This is message #{message_count} in a conversation.
Previous messages (last 3): {session_history[-3:]}
Reply with ONLY a JSON object:
{{"intent": "learning|problem_solving|casual|review", "confidence": 0.0-1.0, "reasoning": "one sentence"}}
Definitions:
learning: user wants to understand a concept, theory, or how something works
problem_solving: user has a specific task to complete or code to fix
casual: general conversation, no learning objective
review: explicitly revisiting previously discussed content"""

        try:
            response = generate_with_retry(
                client=self.client,
                model=self.model_name,
                contents=prompt
            )
            if response and response.text:
                text = strip_json_fences(response.text.strip())
                
                data = json.loads(text)
                result = IntentResult(
                    intent=data.get("intent", "learning"),
                    confidence=float(data.get("confidence", 0.5)),
                    method="llm",
                    reasoning=data.get("reasoning", "parsed from llm")
                )
                logger.debug(f"Intent classified: {result.intent} (method: {result.method})")
                return result
        except Exception as e:
            logger.warning(f"Intent classification LLM pass failed: {e}")
            
        result = IntentResult(
            intent="learning",
            confidence=0.5,
            method="llm",
            reasoning="parse_failed - defaulting to learning"
        )
        logger.debug(f"Intent classified: {result.intent} (method: {result.method})")
        return result

    def should_reclassify(self, session_context: SessionContext, new_message: str) -> bool:
        """Determine if the current session intent should be re-evaluated.

        Args:
            session_context: The current L3 working memory containing message count and intent.
            new_message: The latest message to check for intent shifts (e.g. casual to learning).

        Returns:
            True if a re-classification pass is required based on heuristic or keyword triggers.
        """
        msg_lower = new_message.lower()
        msg_count = session_context.message_count
        intent = getattr(session_context, 'session_intent', 'unknown')

        if intent == "unknown" and msg_count >= 2:
            return True
        if intent != "unknown" and msg_count > 0 and msg_count % 10 == 0:
            return True
        if intent == "casual" and any(kw in msg_lower for kw in LEARNING_KEYWORDS):
            return True
            
        return False

    def extract_profile_signals(self, message: str, session_history: List[str]) -> ProfileSignals:
        """Extract soft signal data to refine the learner's identity model (Layer 1).

        Args:
            message: The current user message to scan for technical terms and style.
            session_history: Contextual history (currently unused but preserved for future signals).

        Returns:
            ProfileSignals containing detected interests, vocabulary level, and style.
        """
        msg_lower = message.lower()
        words = message.split()
        
        # vocabulary_level
        technical_terms = {"recursion", "async", "complexity", "database", "algorithm", "architecture", "scalability", "microservice"}
        tech_count = sum(1 for w in words if len(w) > 10 or w.lower() in technical_terms)
        
        if tech_count >= 3:
            vocab = "technical"
        elif tech_count >= 1:
            vocab = "intermediate"
        else:
            vocab = "basic"

        # communication_style
        if len(words) < 20:
            style = "terse"
        elif any(f in msg_lower for f in {"please", "could you", "would you mind"}):
            style = "formal"
        elif any(i in msg_lower for i in {"lol", "tbh", "ngl", "idk"}):
            style = "informal"
        else:
            style = "informal"

        # detected_interests
        interests = []
        for domain, keywords in INTEREST_DOMAINS.items():
            if any(kw in msg_lower for kw in keywords):
                interests.append(domain)

        # implicit_goals
        implicit = []
        if "internship" in msg_lower or "placement" in msg_lower:
            implicit.append("preparing for placement")
        if "interview" in msg_lower:
            implicit.append("preparing for technical interview")
        if "project" in msg_lower:
            implicit.append("building a project")
        if "exam" in msg_lower or "test" in msg_lower:
            implicit.append("exam preparation")

        return ProfileSignals(
            detected_interests=interests,
            vocabulary_level=vocab,
            communication_style=style,
            implicit_goals=implicit,
            confidence=0.8
        )

intent_classifier_service = IntentClassifierService()
