"""Analyzes learners' performance and cognitive state from conversation logs.

By detecting concept mastery, frustration signals, and intention clarity,
this agent provides the critical feedback signal that allows the system's
memory to evolve and adapt to the user's growing expertise.
"""

import time
from google import genai
import json
from typing import Dict, Any, Optional
from datetime import datetime
from app.core.config import settings
from app.services.session_context_service import session_context_service
from app.services.concept_memory_service import concept_memory_service, slugify_concept
from app.services.llm_utils import strip_json_fences
from app.knowledge.prerequisite_graph import is_in_zpd, get_prerequisites
from app.utils.logger import logger


class EvaluatorAgent:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # =========================================================================
    # NEW: Session-aware evaluation with concept extraction
    # =========================================================================

    async def evaluate_interaction_v2(
        self,
        user_id: str,
        user_message: str,
        mentor_response: str,
        user_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Perform a deep pedagogical analysis of the latest interaction.

        Args:
            user_id: The unique identifier of the learner.
            user_message: What the student said.
            mentor_response: What the mentor replied.
            user_context: Structured dict from MemoryAgent.retrieve_context().

        Returns:
            Analysis dict containing mastery updates, clarity scores, and pace signals.
        """
        profile = user_context.get("profile", {})
        session = user_context.get("session", {})
        concepts = user_context.get("concepts", {})

        session_intent = session.get("session_intent", "unknown")

        # --- INTENT GUARD ---
        if session_intent == "casual":
            # Casual sessions: skip concept analysis entirely.
            return {
                "clarity_score": None,
                "understanding_delta": 0,
                "confusion_trend": "not_applicable",
                "engagement_level": self._estimate_engagement(user_message),
                "struggle_detected": None,
                "concepts_discussed": [],
                "evaluation_mode": "passive",
                "skip_memory_update": True
            }

        # For unknown intent with message_count <= 2: also run passive mode
        if session_intent == "unknown" and session.get("message_count", 0) <= 2:
            return {
                "clarity_score": None,
                "understanding_delta": 0,
                "confusion_trend": "not_applicable",
                "engagement_level": self._estimate_engagement(user_message),
                "struggle_detected": None,
                "concepts_discussed": [],
                "evaluation_mode": "passive",
                "skip_memory_update": True
            }

        # Previous clarity from session (session-scoped, not global)
        prev_clarity = session.get("clarity", 50.0)

        # Build active concept context for the prompt
        active_info = ""
        active = concepts.get("active", {})
        if active:
            lines = []
            for cid, info in active.items():
                lines.append(f"  - {cid}: mastery={info.get('mastery', 0.0):.0%}")
            active_info = "\n".join(lines)
        else:
            active_info = "  (No active concepts tracked yet)"

        prompt = f"""Analyze this mentor-student interaction for learning quality insights.

STUDENT MESSAGE: "{user_message}"
MENTOR RESPONSE: "{mentor_response[:500]}"

STUDENT CONTEXT:
- Experience level: {profile.get('experience_level', 'beginner')}
- Learning style: {profile.get('preferred_learning_style', 'mixed')}
- Preferred tone: {profile.get('mentoring_tone', 'balanced')}
- Session goal: {session.get('goal') or 'not yet established'}
- Session momentum: {session.get('momentum', 'cold_start')}
- Previous session clarity: {prev_clarity}/100
- Active concepts:
{active_info}
- Known confusion points: {', '.join(session.get('confusion_points', [])) or 'none'}

IMPORTANT: Evaluate UNDERSTANDING QUALITY, not just activity or effort.

CORE RULE (NON-NEGOTIABLE):
Explicit expressions of confusion (e.g., "I don't get it", "I'm confused") must NEVER increase clarity score.
- clarity_score must decrease or remain unchanged.
- understanding_delta must be <= 0.
- confusion_trend must be "stable" or "worsening".

WHAT NOT TO USE AS PROGRESS SIGNALS:
- User continuing to chat
- User asking questions
- Mentor giving a long explanation
- Polite tone or effort
- Number of sessions
(Effort != Understanding)

WHAT COUNTS AS POSITIVE UNDERSTANDING:
- Paraphrasing the concept correctly
- Applying concept to new example
- Answering "why" or "how" correctly
- Correcting a previous misconception

## Confusion Classification (only if confusion or low clarity detected)

If clarity_score < 50 OR confusion markers are present, classify the
type of confusion:

confusion_type: one of:
  - "prerequisite_gap" — user lacks knowledge needed for this concept
    (e.g., can't understand recursion because they don't get function scope)
  - "misconception" — user has a specific wrong mental model
    (e.g., thinks recursion creates copies of the function)
  - "surface_confusion" — user doesn't understand the explanation/phrasing
    but probably understands the concept (just needs it rephrased)
  - "overwhelm" — user is trying to process too much at once
    (e.g., "I don't know where to start")
  - "none" — no confusion detected

If confusion_type is "prerequisite_gap":
  - missing_prerequisite: what concept/knowledge is missing?

If confusion_type is "misconception":
  - misconception_detail: what specifically do they believe that's wrong?
  - correct_model: what should they understand instead?

If confusion_type is "overwhelm":
  - overwhelm_source: too many concepts, too complex explanation, or lost context?

OUTPUT AS JSON:
{{
    "clarity_score": 0-100,
    "confusion_trend": "improving" or "stable" or "worsening",
    "understanding_delta": -10 to +10,
    "reasoning": "Explicit reason for score change",
    "stagnation_flags": ["topic1", "topic2"] or [],
    "engagement_level": "high" or "medium" or "low",
    "struggle_detected": null or "topic that needs attention",
    "struggle_severity": "mild" or "moderate" or "significant",
    "positive_signals": ["list of growth indicators"],
    "response_effectiveness": "effective" or "neutral" or "needs_adjustment",
    "suggested_next_focus": "what to focus on next",
    "new_interest_detected": null or "new interest mentioned",
    "stage_change_recommended": null or "new stage suggestion",
    "pace_adjustment": null or "slow_down" or "speed_up" or "maintain",
    "concepts_discussed": ["list of specific technical concepts mentioned or explained — e.g. recursion, base case, stack overflow — NOT vague terms like programming or coding"],
    "concept_clarity": {{"concept_name": 0-100}} ,
    "misconceptions_detected": {{"concept_name": "specific misunderstanding"}},
    "confusion_type": "one of the types listed above",
    "missing_prerequisite": "concept name or null",
    "misconception_detail": "detail string or null",
    "correct_model": "correct model string or null",
    "overwhelm_source": "source string or null"
}}

BE HONEST. Do not inflate clarity_score.
RESPOND ONLY WITH VALID JSON."""

        try:
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            text = strip_json_fences(response.text.strip())

            result = json.loads(text)
        except json.JSONDecodeError as e:
            logger.warning("Evaluator JSON error: %s", e)
            return self._default_evaluation_v2()
        except Exception as e:
            logger.error("Evaluator error: %s", e)
            return self._default_evaluation_v2()

        # =============================================================
        # FAIL-SAFE: STRICT LOGIC ENFORCEMENT (UNTOUCHABLE)
        # Global Invariant: Explicit confusion MUST NOT increase clarity.
        # =============================================================
        explicit_confusion_markers = [
            "don't get it", "dont get it", "don't understand", "dont understand",
            "im confused", "i'm confused", "doesn't make sense", "doesnt make sense",
            "still unclear", "lost", "what do you mean",
        ]

        is_explicitly_confused = any(
            m in user_message.lower() for m in explicit_confusion_markers
        )

        if is_explicitly_confused:
            # 1. Block Clarity Increase
            if result.get("clarity_score", 0) > prev_clarity:
                result["clarity_score"] = prev_clarity
                result["reasoning"] = (
                    result.get("reasoning", "")
                    + " [FAILSAFE: Score capped due to explicit confusion]"
                ).strip()

            # 2. Enforce Non-Positive Delta
            if result.get("understanding_delta", 0) > 0:
                result["understanding_delta"] = 0

            # 3. Block "Improving" Trend
            if result.get("confusion_trend") == "improving":
                result["confusion_trend"] = "stable"

            # 4. Enforce Struggle Detection
            if not result.get("struggle_detected"):
                result["struggle_detected"] = "explicit confusion"
                result["struggle_severity"] = "moderate"

            # 5. Cap concept-level clarity scores too (Phase 4.7 addition)
            # If the user is explicitly confused, no individual concept should
            # score higher than the overall clarity.
            capped_clarity = result.get("clarity_score", 50)
            concept_clarity = result.get("concept_clarity", {})
            for concept_name, score in concept_clarity.items():
                if isinstance(score, (int, float)) and score > capped_clarity:
                    concept_clarity[concept_name] = capped_clarity
            result["concept_clarity"] = concept_clarity
        # =============================================================
        # END FAIL-SAFE
        # =============================================================

        # --- Enhanced fail-safe: Confusion type default ---
        # If confusion was detected by fail-safe but LLM didn't classify type,
        # default to the safest assumption
        if is_explicitly_confused and not result.get("confusion_type"):
            result["confusion_type"] = "surface_confusion"
            # Surface confusion is the safest default — it means "rephrase"
            # rather than assuming a deeper problem

        # Ensure concept fields are present and well-typed
        if not isinstance(result.get("concepts_discussed"), list):
            result["concepts_discussed"] = []
        if not isinstance(result.get("concept_clarity"), dict):
            result["concept_clarity"] = {}
        if not isinstance(result.get("misconceptions_detected"), dict):
            result["misconceptions_detected"] = {}

        # --- ZPD Alignment Check ---
        # This checks if the conversation is teaching in the user's ZPD
        # Uses the prerequisite graph — no LLM involved
        try:
            t_zpd = time.monotonic()
            concepts_discussed = result.get("concepts_discussed", [])
            user_mastery = await concept_memory_service.get_user_mastery_dict(user_id)
            
            zpd_alignment = {}
            for concept_name in concepts_discussed:
                concept_id = slugify_concept(concept_name)
                in_zpd = is_in_zpd(concept_id, user_mastery)
                zpd_alignment[concept_id] = {
                    "in_zpd": in_zpd,
                    "current_mastery": user_mastery.get(concept_id, 0.0),
                    "prerequisite_status": {
                        p: user_mastery.get(p, 0.0)
                        for p in get_prerequisites(concept_id)
                    }
                }

            # If a concept is NOT in ZPD and clarity is low → the confusion is
            # likely because we're teaching in Zone 3 (too hard)
            for concept_id, alignment in zpd_alignment.items():
                if not alignment["in_zpd"] and result.get("clarity_score", 50) < 40:
                    # Override confusion_type to prerequisite_gap
                    result["confusion_type"] = "prerequisite_gap"
                    unmet = [
                        p for p, m in alignment["prerequisite_status"].items()
                        if m < 0.5
                    ]
                    result["missing_prerequisites"] = unmet

            result["zpd_alignment"] = zpd_alignment
            logger.debug(f"ZPD check completed in {(time.monotonic() - t_zpd) * 1000:.1f}ms")
            
            # --- Scaffolding Recommendation ---
            # Based on Bruner's scaffolding theory (1976)
            # Scaffolding level should match the inverse of mastery
            t_scaffolding = time.monotonic()
            primary_concept = concepts_discussed[0] if concepts_discussed else None
            if primary_concept:
                concept_id = slugify_concept(primary_concept)
                mastery = user_mastery.get(concept_id, 0.0)
                if mastery < 0.3:
                    result["scaffolding_recommendation"] = "full"
                elif mastery < 0.6:
                    result["scaffolding_recommendation"] = "partial"
                else:
                    result["scaffolding_recommendation"] = "light"
            else:
                result["scaffolding_recommendation"] = "full"  # safe default
            logger.debug(f"Scaffolding check completed in {(time.monotonic() - t_scaffolding) * 1000:.1f}ms")

        except Exception as e:
            logger.warning(f"Error during ZPD classification: {e}")

        return result

    async def update_memory_from_evaluation_v2(
        self,
        user_id: str,
        session_id: str,
        session_domain: Optional[str],
        evaluation: Dict[str, Any],
    ) -> None:
        """Write evaluation results to session context and concept memory.

        Args:
            user_id: The unique identifier of the learner.
            session_id: The identifier of the active conversation session.
            session_domain: The domain category of the session.
            evaluation: The structured assessment data from the evaluation step.

        Returns:
            None. Updates are dispatched to memory services for persistence.
        """
        # --- Session-scoped clarity update ---
        try:
            t0 = time.monotonic()
            await session_context_service.update_clarity(
                session_id=session_id,
                clarity_score=evaluation.get("clarity_score", 50.0),
                confusion_points=evaluation.get("stagnation_flags", []),
            )
            logger.debug(
                "Evaluator session clarity update: %.1fms",
                (time.monotonic() - t0) * 1000,
            )
        except Exception as e:
            logger.error("Evaluator: session clarity update failed: %s", e)

        # --- Concept extraction & memory update ---
        concepts = evaluation.get("concepts_discussed", [])
        concept_clarity = evaluation.get("concept_clarity", {})
        misconceptions = evaluation.get("misconceptions_detected", {})

        if not concepts:
            logger.debug(
                "Evaluator: no concepts extracted for session=%s, skipping concept memory update",
                session_id,
            )
            return

        try:
            t0 = time.monotonic()
            concept_ids = []
            domain = session_domain or "general"

            for concept_name in concepts:
                if not isinstance(concept_name, str) or not concept_name.strip():
                    continue

                concept_id = slugify_concept(concept_name)
                concept_ids.append(concept_id)

                clarity = concept_clarity.get(
                    concept_name, evaluation.get("clarity_score", 50.0)
                )
                # Ensure clarity is numeric
                if not isinstance(clarity, (int, float)):
                    clarity = evaluation.get("clarity_score", 50.0)

                miscons_raw = misconceptions.get(concept_name, [])
                # Normalize: could be a string or a list
                if isinstance(miscons_raw, str):
                    miscons = [miscons_raw] if miscons_raw else []
                elif isinstance(miscons_raw, list):
                    miscons = [m for m in miscons_raw if isinstance(m, str) and m]
                else:
                    miscons = []

                await concept_memory_service.update_concept(
                    user_id=user_id,
                    concept_id=concept_id,
                    concept_name=concept_name,
                    domain=domain,
                    clarity_score=clarity,
                    session_id=session_id,
                    misconceptions=miscons,
                )

            # Register active concepts in session context
            if concept_ids:
                await session_context_service.add_active_concepts(
                    session_id=session_id,
                    concept_ids=concept_ids,
                )

            elapsed = (time.monotonic() - t0) * 1000
            logger.debug(
                "Evaluator concept extraction: %d concepts updated in %.1fms",
                len(concept_ids),
                elapsed,
            )
        except Exception as e:
            logger.warning(
                "Evaluator: concept memory update failed for user=%s: %s",
                user_id,
                e,
            )

    def _default_evaluation_v2(self) -> Dict[str, Any]:
        """Default evaluation with concept fields for the v2 flow."""
        base = self._default_evaluation()
        base["concepts_discussed"] = []
        base["concept_clarity"] = {}
        base["misconceptions_detected"] = {}
        base["evaluation_mode"] = "active"
        base["skip_memory_update"] = False
        return base

    def _estimate_engagement(self, message: str) -> str:
        """Estimate engagement purely based on message length for passive mode."""
        if len(message) > 100:
            return "high"
        elif len(message) > 30:
            return "medium"
        return "low"

    # =========================================================================
    # LEGACY: Original methods preserved for backward compatibility
    # =========================================================================

    def evaluate_interaction(
        self,
        user_message: str,
        mentor_response: str,
        user_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        DEPRECATED: Use evaluate_interaction_v2() with structured context.
        Kept for unmigrated call sites.
        """
        prev_evaluations = user_context.get("progress", {}).get("evaluation_history", [])
        prev_clarity = prev_evaluations[-1].get("clarity_score", 50) if prev_evaluations else 50

        prompt = f"""Analyze this mentor-student interaction for learning quality insights.

STUDENT MESSAGE: "{user_message}"
MENTOR RESPONSE: "{mentor_response[:500]}"

STUDENT CONTEXT:
- Stage: {user_context.get('profile', {}).get('stage', 'unknown')}
- Learning pace: {user_context.get('profile', {}).get('learning_pace', 'moderate')}
- Known struggles: {[s.get('topic') for s in user_context.get('struggles', [])[:3]]}
- Onboarding style preference: {user_context.get('onboarding', {}).get('mentoring_style', 'supportive')}
- Previous clarity score: {prev_clarity}

IMPORTANT: Evaluate UNDERSTANDING QUALITY, not just activity or effort.

CORE RULE (NON-NEGOTIABLE):
Explicit expressions of confusion (e.g., "I don't get it", "I'm confused") must NEVER increase clarity score.
- clarity_score must decrease or remain unchanged.
- understanding_delta must be <= 0.
- confusion_trend must be "stable" or "worsening".

WHAT NOT TO USE AS PROGRESS SIGNALS:
- User continuing to chat
- User asking questions
- Mentor giving a long explanation
- Polite tone or effort
- Number of sessions
(Effort != Understanding)

WHAT COUNTS AS POSITIVE UNDERSTANDING:
- Paraphrasing the concept correctly
- Applying concept to new example
- Answering "why" or "how" correctly
- Correcting a previous misconception

OUTPUT AS JSON:
{{
    "clarity_score": 0-100,
    "confusion_trend": "improving" or "stable" or "worsening",
    "understanding_delta": -10 to +10,
    "reasoning": "Explicit reason for score change (e.g., 'User stated confusion')",
    "stagnation_flags": ["topic1", "topic2"] or [],
    "engagement_level": "high" or "medium" or "low",
    "struggle_detected": null or "topic that needs attention",
    "struggle_severity": "mild" or "moderate" or "significant",
    "positive_signals": ["list of growth indicators"],
    "response_effectiveness": "effective" or "neutral" or "needs_adjustment",
    "suggested_next_focus": "what to focus on in future interactions",
    "new_interest_detected": null or "new interest mentioned",
    "stage_change_recommended": null or "new stage suggestion",
    "pace_adjustment": null or "slow_down" or "speed_up" or "maintain"
}}

BE HONEST. Do not inflate clarity_score.
RESPOND ONLY WITH VALID JSON."""

        try:
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            text = strip_json_fences(response.text.strip())

            result = json.loads(text)

            # =============================================================
            # FAIL-SAFE: STRICT LOGIC ENFORCEMENT (UNTOUCHABLE)
            # =============================================================
            explicit_confusion_markers = [
                "don't get it", "dont get it", "don't understand", "dont understand",
                "im confused", "i'm confused", "doesn't make sense", "doesnt make sense",
                "still unclear", "lost", "what do you mean",
            ]

            is_explicitly_confused = any(
                m in user_message.lower() for m in explicit_confusion_markers
            )

            if is_explicitly_confused:
                if result.get("clarity_score", 0) > prev_clarity:
                    result["clarity_score"] = prev_clarity
                    result["reasoning"] = (
                        result.get("reasoning", "")
                        + " [FAILSAFE: Score capped due to explicit confusion]"
                    ).strip()

                if result.get("understanding_delta", 0) > 0:
                    result["understanding_delta"] = 0

                if result.get("confusion_trend") == "improving":
                    result["confusion_trend"] = "stable"

                if not result.get("struggle_detected"):
                    result["struggle_detected"] = "explicit confusion"
                    result["struggle_severity"] = "moderate"
            # =============================================================

            return result
        except Exception as e:
            logger.error("Evaluator error: %s", e)
            return self._default_evaluation()

    def analyze_roadmap_feedback(
        self,
        feedback_list: list,
        current_memory: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Analyze accumulated roadmap feedback to determine adjustments."""
        if not feedback_list:
            return {"action": "none", "insights": []}

        stuck_count = 0
        unclear_count = 0
        needs_help_count = 0
        feedback_summary = []

        for fb in feedback_list:
            fb_type = fb.get("feedback_type", "")
            if "stuck" in fb_type:
                stuck_count += 1
            elif "unclear" in fb_type or "not_clear" in fb_type:
                unclear_count += 1
            elif "help" in fb_type:
                needs_help_count += 1

            if fb.get("message"):
                feedback_summary.append(fb["message"])

        prompt = f"""Analyze this roadmap feedback to determine learning adjustments.

FEEDBACK COUNTS:
- Stuck on steps: {stuck_count}
- Steps unclear: {unclear_count}
- Needs help: {needs_help_count}

USER MESSAGES:
{feedback_summary[:5]}

CURRENT USER STATE:
- Learning pace: {current_memory.get('profile', {}).get('learning_pace', 'moderate')}
- Experience level: {current_memory.get('onboarding', {}).get('experience_level', 'intermediate')}
- Regeneration count: {current_memory.get('progress', {}).get('roadmap_regeneration_count', 0)}

OUTPUT AS JSON:
{{
    "action": "regenerate" or "adjust_pace" or "add_support" or "none",
    "new_learning_pace": "slow" or "moderate" or "fast" or null,
    "difficulty_areas": ["topic1", "topic2"],
    "recommendations": ["specific recommendation"],
    "should_simplify": true or false
}}

RESPOND ONLY WITH JSON."""

        try:
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            text = strip_json_fences(response.text.strip())

            return json.loads(text)
        except Exception as e:
            logger.error("Roadmap feedback analysis error: %s", e)
            return {
                "action": "regenerate" if stuck_count > 1 else "none",
                "new_learning_pace": "slow" if stuck_count > 2 else None,
                "difficulty_areas": [],
                "recommendations": [],
                "should_simplify": stuck_count > 1,
            }

    def detect_struggle(self, message: str) -> Optional[Dict[str, Any]]:
        """Quick check for struggles in a user message."""
        struggle_indicators = [
            "stuck", "confused", "don't understand", "hard", "difficult",
            "struggling", "lost", "overwhelmed", "can't", "help",
            "frustrated", "not sure", "unclear", "complicated",
        ]

        message_lower = message.lower()

        for indicator in struggle_indicators:
            if indicator in message_lower:
                prompt = f"""A student said: "{message}"

Is this indicating a struggle? If yes, what topic?

OUTPUT AS JSON:
{{
    "is_struggle": true or false,
    "topic": null or "brief topic description",
    "severity": "mild, moderate, or significant"
}}

RESPOND ONLY WITH JSON."""

                try:
                    response = self.client.models.generate_content(
                        model=settings.GEMINI_MODEL,
                        contents=prompt,
                    )
                    text = strip_json_fences(response.text.strip())

                    return json.loads(text)
                except Exception:
                    return {
                        "is_struggle": True,
                        "topic": "general difficulty",
                        "severity": "mild",
                    }

        return {"is_struggle": False, "topic": None, "severity": None}

    async def update_memory_from_evaluation(
        self,
        user_id: str,
        evaluation: Dict[str, Any],
    ):
        """
        DEPRECATED: Use update_memory_from_evaluation_v2() for session-scoped writes.
        Kept for backward compatibility — still writes to legacy user_memory.
        """
        from app.agents.memory_agent import MemoryAgent

        memory = MemoryAgent()

        if evaluation.get("struggle_detected"):
            await memory.update_struggle(
                user_id,
                evaluation["struggle_detected"],
                evaluation.get("struggle_severity", "mild"),
            )

        if evaluation.get("pace_adjustment"):
            pace_map = {
                "slow_down": "slow",
                "speed_up": "fast",
                "maintain": None,
            }
            new_pace = pace_map.get(evaluation["pace_adjustment"])
            if new_pace:
                await memory.update_profile(user_id, learning_pace=new_pace)

        if evaluation.get("new_interest_detected"):
            context = await memory.get_user_context(user_id)
            interests = context.get("profile", {}).get("interests", [])
            new_interest = evaluation["new_interest_detected"]
            if new_interest not in interests:
                interests.append(new_interest)
                await memory.update_profile(user_id, interests=interests)

        if evaluation.get("stage_change_recommended"):
            await memory.update_profile(
                user_id,
                stage=evaluation["stage_change_recommended"],
            )

    async def update_memory_from_roadmap_feedback(
        self,
        user_id: str,
        analysis: Dict[str, Any],
    ):
        """Update memory based on roadmap feedback analysis."""
        from app.agents.memory_agent import MemoryAgent
        from app.db.mongodb import get_user_memory_collection

        memory = MemoryAgent()
        memory_collection = get_user_memory_collection()

        updates: dict = {"updated_at": datetime.utcnow()}

        if analysis.get("new_learning_pace"):
            updates["profile.learning_pace"] = analysis["new_learning_pace"]

        await memory_collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {"progress.roadmap_regeneration_count": 1},
                "$set": updates,
            },
        )

        for topic in analysis.get("difficulty_areas", []):
            await memory.update_struggle(user_id, topic, "moderate")

    def _default_evaluation(self) -> Dict[str, Any]:
        """Return default evaluation when analysis fails."""
        return {
            "clarity_score": 50,
            "confusion_trend": "stable",
            "understanding_delta": 0,
            "reasoning": "Default evaluation due to error",
            "stagnation_flags": [],
            "engagement_level": "medium",
            "struggle_detected": None,
            "struggle_severity": None,
            "positive_signals": [],
            "response_effectiveness": "neutral",
            "suggested_next_focus": "continue current path",
            "new_interest_detected": None,
            "stage_change_recommended": None,
            "pace_adjustment": None,
        }
