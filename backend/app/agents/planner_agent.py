"""
Planner Agent
Decides guidance strategy based on structured three-layer context (Phase 4.7).
Outputs structured JSON decisions — no natural language.

Momentum-aware strategy overrides are applied BEFORE the LLM call. These are
deterministic, hard-coded rules that the LLM cannot override — same philosophy
as the evaluator's confusion fail-safe.
"""

from google import genai
import json
from typing import Dict, Any, Optional
from app.core.config import settings
from app.services.session_context_service import session_context_service
from app.utils.logger import logger

def compute_deterministic_strategy(context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Apply pedagogical rules to determine strategy.

    Returns a strategy dict if a rule matches, None if LLM should decide.
    Rules are ordered by priority — first match wins.

    These rules encode Vygotsky's ZPD, Bruner's scaffolding, and
    Csikszentmihalyi's flow theory as deterministic logic.
    """
    session = context.get("session", {})
    last_eval = context.get("last_evaluation", {})
    concepts = context.get("concepts", {})
    momentum = session.get("momentum", "cold_start")
    clarity = session.get("clarity", 50.0)
    message_count = session.get("message_count", 0)
    confusion_type = last_eval.get("confusion_type", "none")
    scaffolding = last_eval.get("scaffolding_recommendation", "full")
    zpd = last_eval.get("zpd_alignment", {})

    # ─── RULE 1: First message in session ──────────────────
    # Goal: Orient the learner. Don't dive into content immediately.
    # Theoretical Basis: Establishing joint attention before cognitive load.
    if message_count == 0:
        return {
            "strategy": "guide",
            "tone": "warm",
            "pacing": "slow",
            "reasoning": "First message — orient and establish session goal",
            "should_assess": False,
            "should_infer_goal": True
        }

    # ─── RULE 2: Prerequisite gap detected ─────────────────
    # The user is trying to learn something they're not ready for.
    # Theoretical Basis: Vygotsky's Zone of Proximal Development (Zone 3 - Panic Zone).
    if confusion_type == "prerequisite_gap":
        missing = last_eval.get("missing_prerequisites", [])
        return {
            "strategy": "redirect",
            "tone": "supportive",
            "pacing": "slow",
            "reasoning": f"Prerequisite gap detected. Missing: {missing}. Redirect to foundational concept.",
            "redirect_to_concepts": missing,
            "should_assess": False,
            "should_infer_goal": False
        }

    # ─── RULE 3: Misconception detected ────────────────────
    # The user has a specific wrong mental model. Address it directly.
    # Theoretical Basis: Constructivist error correction.
    if confusion_type == "misconception":
        return {
            "strategy": "correct_misconception",
            "tone": "supportive",
            "pacing": "slow",
            "reasoning": f"Misconception detected: {last_eval.get('misconception_detail', 'unknown')}",
            "misconception_to_address": last_eval.get("misconception_detail"),
            "correct_model": last_eval.get("correct_model"),
            "should_assess": True,
            "should_infer_goal": False
        }

    # ─── RULE 4: User is overwhelmed ──────────────────────
    # Too much information. Simplify, break it down.
    # Theoretical Basis: Cognitive Load Theory (Intrinsic vs Extraneous overloads).
    if confusion_type == "overwhelm":
        return {
            "strategy": "simplify",
            "tone": "calm",
            "pacing": "very_slow",
            "reasoning": "User is overwhelmed. Break down into smallest possible step.",
            "should_assess": False,
            "should_infer_goal": False
        }

    # ─── RULE 5: Stuck state (from momentum) ──────────────
    # Flow is broken. Provide encouragement.
    # Theoretical Basis: Csikszentmihalyi's Flow Theory (Anxiety state).
    if momentum == "stuck" and clarity < 30:
        return {
            "strategy": "encourage",
            "tone": "warm",
            "pacing": "slow",
            "reasoning": "User is stuck with very low clarity. Encourage before teaching.",
            "should_assess": False,
            "should_infer_goal": False
        }

    # ─── RULE 6: In flow, high clarity ────────────────────
    # User is learning effectively. Push them.
    # Theoretical Basis: Csikszentmihalyi's Flow Theory (Flow channel optimization).
    if momentum == "flowing" and clarity > 75:
        return {
            "strategy": "challenge",
            "tone": context.get("profile", {}).get("mentoring_tone", "balanced"),
            "pacing": "fast",
            "reasoning": "User is in flow with high clarity. Challenge to deepen understanding.",
            "should_assess": True,
            "should_infer_goal": False
        }

    # ─── RULE 7: Scaffolding-based default ────────────────
    # Theoretical Basis: Bruner's Scaffolding Theory (1976)
    if scaffolding == "full":
        return {
            "strategy": "explain",
            "tone": "supportive",
            "pacing": "slow",
            "reasoning": "Low mastery on active concepts. Full scaffolding — step-by-step explanation.",
            "should_assess": False,
            "should_infer_goal": False
        }

    if scaffolding == "partial":
        return {
            "strategy": "guide",
            "tone": context.get("profile", {}).get("mentoring_tone", "balanced"),
            "pacing": "medium",
            "reasoning": "Medium mastery. Partial scaffolding — guide with hints.",
            "should_assess": True,
            "should_infer_goal": False
        }

    if scaffolding == "light":
        return {
            "strategy": "challenge",
            "tone": "challenging",
            "pacing": "fast",
            "reasoning": "High mastery. Light scaffolding — challenge to solidify.",
            "should_assess": True,
            "should_infer_goal": False
        }

    return None

class PlannerAgent:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # =========================================================================
    # NEW: Session-aware planning
    # =========================================================================

    async def plan_response_v2(
        self, user_context: Dict[str, Any], current_message: str
    ) -> Dict[str, Any]:
        """
        Plan the response strategy using structured three-layer context.

        This replaces the original plan_response() for the new orchestrator flow.
        It uses profile, session, and concept data to make informed decisions.

        Steps:
            1. Extract context layers
            2. Apply deterministic momentum overrides (pre-LLM)
            3. Call LLM for nuanced strategy
            4. Apply post-LLM overrides (enforce deterministic rules)
            5. Persist session_goal_inference if detected

        Args:
            user_context: Structured dict from MemoryAgent.retrieve_context().
            current_message: The user's message.

        Returns:
            Strategy dict with keys: strategy, tone, pacing, focus_concepts,
            should_assess, session_goal_inference, plus legacy fields.
        """
        profile = user_context.get("profile", {})
        session = user_context.get("session", {})
        concepts = user_context.get("concepts", {})
        recent_messages = user_context.get("recent_messages", [])
        last_eval = user_context.get("last_evaluation", {})
        pattern_insights = user_context.get("pattern_insights", {})

        # --- Phase 5.3 Deterministic Strategy Core ---
        override_strategy = compute_deterministic_strategy(user_context)
        if override_strategy:
            # Merge with safe defaults so the Executor doesn't crash on missing dict keys
            final_strategy = self._default_strategy_v2()
            final_strategy.update(override_strategy)
            
            # The orchestrator uses _override_applied for Cognitive Trace logging
            final_strategy["_override_applied"] = override_strategy.get("reasoning", "deterministic_rule")
            
            # Persist session goal if rule inferred it
            if final_strategy.get("session_goal_inference"):
                try:
                    goal_inference = final_strategy["session_goal_inference"]
                    domain = final_strategy.get("inferred_domain", "general")
                    await session_context_service.update_session_goal(
                        session_id=session.get("id"),
                        user_id=profile.get("user_id"),
                        goal=goal_inference,
                        domain=domain,
                    )
                except Exception as e:
                    logger.error("Failed to persist session goal inference from override: %s", e)
            
            logger.debug(f"Deterministic Override Triggered: {final_strategy['_override_applied']}")
            return final_strategy

        # --- Base LLM Fallback (only reached if all deterministic rules returned None) ---
        # --- Build concept mastery section for prompt ---
        concept_section = self._format_concept_section(concepts)

        # --- Build recent conversation section ---
        recent_section = ""
        if recent_messages:
            lines = []
            for msg in recent_messages[-5:]:
                role = "Student" if msg.get("sender") == "user" else "Mentor"
                content = msg.get("content", "")[:200]
                lines.append(f"  {role}: {content}")
            recent_section = "\n".join(lines)

        prompt = f"""You are a planning agent for an AI mentor. Analyze this context and decide the guidance strategy.

## User Profile
Experience: {profile.get('experience_level', 'beginner')}
Learning style: {profile.get('preferred_learning_style', 'mixed')}
Preferred tone: {profile.get('mentoring_tone', 'balanced')}
Career interests: {', '.join(profile.get('career_interests', [])) or 'not specified'}
Known strengths: {', '.join(profile.get('strengths_summary', [])) or 'none yet'}
Known weaknesses: {', '.join(profile.get('weaknesses_summary', [])) or 'none yet'}

## Session State
Goal: {session.get('goal') or 'Not yet established — infer from message'}
Momentum: {session.get('momentum', 'cold_start')}
Session clarity: {session.get('clarity', 50.0)}/100
Messages so far: {session.get('message_count', 0)}
Active concepts: {', '.join(session.get('active_concepts', [])) or 'none yet'}
Current confusion: {', '.join(session.get('confusion_points', [])) or 'none'}

## Concept Mastery (relevant)
{concept_section}

## Last Evaluation Context (Phase 5.2 metrics)
Confusion type: {last_eval.get('confusion_type', 'none')}
Missing prerequisites: {', '.join(last_eval.get('missing_prerequisites', [])) or 'none'}
Scaffolding recommendation: {last_eval.get('scaffolding_recommendation', 'full')}
ZPD Alignment Data: {json.dumps(last_eval.get('zpd_alignment', {{}}))}

## Learning Patterns & Velocity (Phase 5.1 metrics)
Overall velocity: {pattern_insights.get('velocity', {{}}).get('overall_velocity', 'unknown')}
Primary struggle pattern: {pattern_insights.get('struggle_patterns', {{}}).get('primary_struggle_type') or 'none'}

## Recent Conversation
{recent_section or '(No prior messages in this session)'}

## Context Summary
{user_context.get('context_summary', 'New user')}

## Task
Given the user's message: "{current_message}"
And the above context, decide:

OUTPUT A JSON OBJECT with this structure:
{{
    "strategy": "one of: explain, guide, challenge, review, encourage, redirect",
    "tone": "warm, gentle, direct, curious, or affirming — adapt to momentum (if stuck, be more supportive regardless of preference)",
    "pacing": "slow, medium, or fast — based on session clarity and experience level",
    "focus_concepts": ["list of concept names the response should focus on"],
    "should_assess": true or false (should this response include a comprehension check?),
    "session_goal_inference": "if no session goal is set, what does this message suggest the goal is? null if already set",
    "focus_areas": ["list of topics to address"],
    "should_ask_question": true or false,
    "detected_emotion": "neutral, frustrated, excited, confused, or discouraged",
    "roadmap_relevant": true or false,
    "verbosity": "brief, normal, or detailed",
    "max_lines": 6,
    "chat_intent": "short 3-5 word description of what this conversation is about",
    "memory_update": {{
        "new_interest": null or "string",
        "new_goal": null or "string",
        "struggle_detected": null or "topic string"
    }}
}}

VERBOSITY RULES:
- Use "brief" (4 lines) for simple acknowledgments, greetings, quick encouragement
- Use "normal" (6 lines) for standard mentoring responses
- Use "detailed" (8 lines) ONLY for complex explanations or teaching moments

STRATEGY RULES:
- If momentum is "stuck", prefer "encourage" or "review" — do NOT push forward
- If this is the first message (message_count == 0), prefer "guide" to orient the user
- If clarity > 80 and momentum is "flowing", you may use "challenge"
- Always consider concept mastery when choosing focus_concepts

RESPOND ONLY WITH VALID JSON, NO OTHER TEXT."""

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            text = response.text.strip()

            # Clean markdown fences
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]

            strategy = json.loads(text.strip())
        except json.JSONDecodeError as e:
            logger.warning("Planner JSON error: %s", e)
            strategy = self._default_strategy_v2()
        except Exception as e:
            logger.error("Planner Agent error: %s", e)
            strategy = self._default_strategy_v2()

        # Ensure focus_concepts is always a list
        if not isinstance(strategy.get("focus_concepts"), list):
            strategy["focus_concepts"] = []

        # --- Persist session goal inference ---
        goal_inference = strategy.get("session_goal_inference")
        session_id = session.get("session_id")
        if goal_inference and session.get("goal") is None:
            # session_id might not be in the summary dict — check user_context
            sid = user_context.get("_session_id") or session_id
            if sid:
                try:
                    # Infer domain from focus_concepts or active concepts
                    domain = None
                    active_concepts = concepts.get("active", {})
                    if active_concepts:
                        # Use domain from first active concept if available
                        first_active = next(iter(active_concepts.values()), {})
                        domain = first_active.get("domain")
                    await session_context_service.update_session_goal(
                        session_id=sid,
                        user_id=user_context.get("_user_id", ""),
                        goal=goal_inference,
                        domain=domain,
                    )
                    logger.debug(
                        "Planner persisted session goal: %r (domain=%r)",
                        goal_inference,
                        domain,
                    )
                except Exception as e:
                    logger.error("Failed to persist session goal inference: %s", e)

        return strategy


    @staticmethod
    def _format_concept_section(concepts: dict) -> str:
        """Format concept mastery data for the LLM prompt."""
        active = concepts.get("active", {})
        related_weak = concepts.get("related_weak", [])
        avg = concepts.get("overall_mastery_average", 0.0)

        lines = []

        if active:
            for cid, info in active.items():
                mastery = info.get("mastery", 0.0)
                misconceptions = info.get("misconceptions", [])
                miscon_str = f" | Misconceptions: {', '.join(misconceptions)}" if misconceptions else ""
                lines.append(f"  - {cid}: mastery={mastery:.0%}, exposure={info.get('exposure_count', 0)}{miscon_str}")
        else:
            lines.append("  (No active concepts in this session)")

        if related_weak:
            lines.append("  Related weak concepts (consider reviewing):")
            for rw in related_weak:
                lines.append(f"    - {rw.get('concept_name', rw.get('concept_id', '?'))}: mastery={rw.get('mastery', 0.0):.0%}")

        if avg > 0:
            lines.append(f"  Overall mastery average: {avg:.0%}")

        return "\n".join(lines)

    def _default_strategy_v2(self) -> Dict[str, Any]:
        """Default strategy for the three-layer context flow."""
        return {
            "strategy": "guide",
            "tone": "warm",
            "pacing": "medium",
            "focus_concepts": [],
            "should_assess": False,
            "session_goal_inference": None,
            "focus_areas": ["general guidance"],
            "should_ask_question": True,
            "detected_emotion": "neutral",
            "roadmap_relevant": False,
            "verbosity": "normal",
            "max_lines": 6,
            "chat_intent": "new conversation",
            "memory_update": {
                "new_interest": None,
                "new_goal": None,
                "struggle_detected": None,
            },
        }

    # =========================================================================
    # LEGACY: Original methods preserved for backward compatibility
    # =========================================================================

    def plan_response(
        self, user_context: Dict[str, Any], current_message: str
    ) -> Dict[str, Any]:
        """
        DEPRECATED: Use plan_response_v2() with structured context instead.
        Kept for unmigrated call sites.
        """
        eval_history = user_context.get("progress", {}).get("evaluation_history", [])
        recent_clarity = eval_history[-1].get("clarity_score", 50) if eval_history else 50
        confusion_trend = eval_history[-1].get("confusion_trend", "stable") if eval_history else "stable"
        effort_metrics = user_context.get("progress", {}).get("effort_metrics", {})

        if recent_clarity < 40:
            strategy_hint = "User is struggling (clarity < 40%). Use supportive tone, slower pace, revisit fundamentals."
        elif recent_clarity >= 70:
            strategy_hint = "User understands well (clarity >= 70%). Can challenge more, introduce advanced concepts."
        elif confusion_trend == "worsening":
            strategy_hint = "Understanding is declining. Slow down, check for gaps, don't push forward."
        else:
            strategy_hint = "Moderate understanding. Continue at current pace with regular check-ins."

        prompt = f"""You are a planning agent for an AI mentor. Analyze this context and decide the guidance strategy.

USER CONTEXT:
- Profile: {user_context.get('profile', {})}
- Struggles: {user_context.get('struggles', [])}
- Progress: {user_context.get('progress', {})}
- Context Summary: {user_context.get('context_summary', 'New user')}
- Recent Interactions: {user_context.get('recent_interactions', [])}

EVALUATOR INSIGHTS (CRITICAL - use these to inform your strategy):
- Current clarity score: {recent_clarity}/100
- Confusion trend: {confusion_trend}
- Total sessions: {effort_metrics.get('total_sessions', 0)}
- Strategy hint: {strategy_hint}

CURRENT MESSAGE: "{current_message}"

OUTPUT A JSON OBJECT with this structure:
{{
    "strategy": "one of: encourage, teach, challenge, reflect, support, celebrate",
    "tone": "warm, gentle, direct, curious, or affirming",
    "focus_areas": ["list of topics to address"],
    "should_ask_question": true or false,
    "detected_emotion": "neutral, frustrated, excited, confused, or discouraged",
    "roadmap_relevant": true or false,
    "pacing": "slow, normal, or accelerated",
    "verbosity": "brief, normal, or detailed",
    "max_lines": 6,
    "voice_output_required": false,
    "chat_intent": "short 3-5 word description of what this conversation is about, e.g. 'career roadmap discussion' or 'learning python basics'",
    "memory_update": {{
        "new_interest": null or "string",
        "new_goal": null or "string",
        "struggle_detected": null or "topic string"
    }}
}}

VERBOSITY RULES:
- Use "brief" (4 lines) for simple acknowledgments, greetings, quick encouragement
- Use "normal" (6 lines) for standard mentoring responses
- Use "detailed" (8 lines) ONLY for complex explanations or teaching moments

IMPORTANT: Adjust your strategy based on the clarity score. Do not push forward if clarity is low.
RESPOND ONLY WITH VALID JSON, NO OTHER TEXT."""

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            text = response.text.strip()

            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]

            return json.loads(text.strip())
        except json.JSONDecodeError as e:
            logger.warning("Planner JSON error: %s", e)
            return self._default_strategy()
        except Exception as e:
            logger.error("Planner Agent error: %s", e)
            return self._default_strategy()

    def plan_roadmap_adjustment(
        self,
        current_roadmap: Dict[str, Any],
        feedback: list,
    ) -> Dict[str, Any]:
        """Plan adjustments to a roadmap based on user feedback."""
        stuck_steps = [f for f in feedback if f.get("feedback_type") == "stuck"]
        unclear_steps = [f for f in feedback if f.get("feedback_type") == "not_clear"]
        help_needed = [f for f in feedback if f.get("feedback_type") == "needs_help"]

        prompt = f"""You are a planning agent. A user has provided feedback on their learning roadmap.

CURRENT ROADMAP GOAL: {current_roadmap.get('goal', 'Unknown')}
STAGES: {len(current_roadmap.get('stages', []))}

FEEDBACK SUMMARY:
- Steps marked STUCK: {len(stuck_steps)}
- Steps marked UNCLEAR: {len(unclear_steps)}
- Steps needing HELP: {len(help_needed)}

Specific feedback:
{json.dumps(feedback[:5], indent=2, default=str)}

OUTPUT A JSON OBJECT with this structure:
{{
    "action": "simplify, break_down, add_resources, restart_basics, or adjust_path",
    "reasoning": "brief explanation",
    "simplify_stages": [list of stage IDs to simplify],
    "add_prerequisites": true or false,
    "recommended_focus": "what to focus on next",
    "encouragement_needed": true or false
}}

RESPOND ONLY WITH VALID JSON."""

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            text = response.text.strip()

            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]

            return json.loads(text.strip())
        except Exception as e:
            logger.error("Planner roadmap error: %s", e)
            return {
                "action": "simplify",
                "reasoning": "Providing gentler steps based on feedback",
                "simplify_stages": [],
                "add_prerequisites": True,
                "recommended_focus": "foundational concepts",
                "encouragement_needed": True,
            }

    def _default_strategy(self) -> Dict[str, Any]:
        """Return a safe default strategy (legacy)."""
        return {
            "strategy": "support",
            "tone": "warm",
            "focus_areas": ["general guidance"],
            "should_ask_question": True,
            "detected_emotion": "neutral",
            "roadmap_relevant": False,
            "pacing": "normal",
            "verbosity": "normal",
            "max_lines": 6,
            "voice_output_required": False,
            "chat_intent": "new conversation",
            "memory_update": {
                "new_interest": None,
                "new_goal": None,
                "struggle_detected": None,
            },
        }
