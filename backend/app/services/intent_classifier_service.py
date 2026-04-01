"""
Intent Classifier Service
Classifies chat messages into learning intents to control evaluator behavior.
"""
import logging
import json
from dataclasses import dataclass
from typing import List, Optional

from google import genai
from app.core.config import settings
from app.services.llm_utils import generate_with_retry
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
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        # Using 2.5 flash as standard fast generic model since standard LLM calls in this codebase use it (like planner agent).
        self.model_name = "gemini-2.5-flash"

    def classify(self, message: str, message_count: int, session_history: List[str]) -> IntentResult:
        """
        Classifies the intent of a message in a tutoring/mentorship context.
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
                text = response.text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                
                data = json.loads(text.strip())
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
        """
        Determines if the current intent should be re-evaluated.
        Returns True if:
        - intent is "unknown" AND message_count >= 3
        - intent is NOT "unknown" AND message_count % 10 == 0
        - intent is "casual" AND any LEARNING_KEYWORDS found in new_message
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
        """
        Extracts soft signals about the user to help build their UserProfile over time.
        Deterministic - no LLM calls.
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
