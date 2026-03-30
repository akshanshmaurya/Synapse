"""
Agent Orchestrator
Coordinates all agents to process user messages and manage sessions.

Pipeline (Phase 4.7 — 10 steps):
    1. Save user message to DB (synchronous)
    2. Load/create session context (NEW — SessionContextService)
    3. Assemble memory from 3 layers (CHANGED — MemoryAgent facade)
    4. Planner decides strategy using layered context (CHANGED)
    5. Executor generates response
    6. Save mentor response to DB (synchronous)
    7. Increment session message count (NEW)
    8. Update chat title (first message only)
    9. Prepare result
   10. Evaluator + memory updates (async background, session-scoped)

CRITICAL: Messages are saved synchronously BEFORE returning response.
Evaluator and memory updates run asynchronously to not block the user.

NOTE: Throughout this file, session_id IS chat_id. They are the same value.
The SessionContext model uses session_id; the chat system uses chat_id.
Both refer to the unique identifier for a single conversation.
"""

import asyncio
import time
import uuid
from typing import Dict, Any, Optional

from app.agents.memory_agent import MemoryAgent
from app.agents.planner_agent import PlannerAgent
from app.agents.executor_agent import ExecutorAgent
from app.agents.evaluator_agent import EvaluatorAgent
from app.services.chat_service import chat_service
from app.services.session_context_service import session_context_service
from app.services.trace_service import trace_service
from app.models.chat import MessageSender
from app.utils.logger import logger


class AgentOrchestrator:
    def __init__(self):
        self.memory_agent = MemoryAgent()
        self.planner_agent = PlannerAgent()
        self.executor_agent = ExecutorAgent()
        self.evaluator_agent = EvaluatorAgent()

    async def process_message_async(
        self,
        user_id: str,
        message: str,
        chat_id: Optional[str] = None,
        session_goal: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Main message processing pipeline (async).

        session_id == chat_id throughout — see module docstring.
        """
        request_id = uuid.uuid4().hex[:8]
        pipeline_start = time.monotonic()
        step_timings: Dict[str, float] = {}

        # Get or create chat session
        if not chat_id:
            chat_id = await chat_service.get_or_create_active_chat(user_id)

        # use_v2 tracks whether three-layer context is available.
        # If any new service fails, we fall back to legacy behavior.
        use_v2 = True

        try:
            # ========== STEP 1: SAVE USER MESSAGE IMMEDIATELY ==========
            t0 = time.monotonic()
            await chat_service.add_message(
                chat_id=chat_id,
                user_id=user_id,
                sender=MessageSender.USER,
                content=message,
            )
            step_timings["1_save_message"] = _elapsed(t0)

            await trace_service.add_trace(
                request_id=request_id,
                agent="Persistence",
                action="User Message Saved",
                details={"chat_id": chat_id, "length": len(message)},
                user_id=user_id,
                session_id=chat_id,
                input_summary=f"User sent a message ({len(message)} chars) to chat {chat_id}.",
                decision="Persist user message to MongoDB before any processing.",
                reasoning="Messages must be stored synchronously first so they are never lost, even if downstream agents fail.",
                output_summary="User message written to chat collection.",
            )

            # ========== STEP 2: LOAD/CREATE SESSION CONTEXT (NEW) ==========
            t0 = time.monotonic()
            try:
                session_context = await session_context_service.get_or_create(
                    session_id=chat_id,  # session_id == chat_id
                    user_id=user_id,
                )

                # If the caller explicitly set a session goal, persist it now.
                # This takes priority over any goal the planner might infer later.
                if session_goal and use_v2:
                    await session_context_service.update_session_goal(
                        session_id=chat_id,
                        user_id=user_id,
                        goal=session_goal,
                    )
                    logger.debug("Explicit session goal set: %r", session_goal)

            except Exception as e:
                logger.error("Session context load failed, falling back to legacy: %s", e)
                session_context = None
                use_v2 = False
            step_timings["2_session_context"] = _elapsed(t0)

            # ========== STEP 3: ASSEMBLE MEMORY FROM 3 LAYERS ==========
            t0 = time.monotonic()
            if use_v2:
                try:
                    user_context = await self.memory_agent.retrieve_context(
                        user_id=user_id,
                        session_id=chat_id,
                        message=message,
                    )
                    # Inject identifiers for downstream use (planner needs these)
                    user_context["_session_id"] = chat_id
                    user_context["_user_id"] = user_id
                except Exception as e:
                    logger.error("Three-layer context assembly failed, falling back to legacy: %s", e)
                    use_v2 = False

            if not use_v2:
                # Legacy fallback — load from flat UserMemory
                user_context = await self.memory_agent.get_user_context(user_id)
                recent_context = await chat_service.format_context_for_llm(chat_id, n=5)
                user_context["recent_chat"] = recent_context

            step_timings["3_memory_assembly"] = _elapsed(t0)

            # Trace: summarise context for observability
            if use_v2:
                session_summary = user_context.get("session", {})
                profile_summary = user_context.get("profile", {})
                timing_info = user_context.get("_timing", {})
                missing = user_context.get("_missing", [])

                await trace_service.add_trace(
                    request_id=request_id,
                    agent="Memory",
                    action="Context Assembled (v2)",
                    details={
                        "layers": "profile+session+concepts",
                        "timing": timing_info,
                        "missing": missing,
                    },
                    user_id=user_id,
                    session_id=chat_id,
                    input_summary=(
                        f"Assembled three-layer context for user '{user_id}', session '{chat_id}'."
                    ),
                    decision="Fetch profile, session, concept memory, and recent messages in parallel.",
                    reasoning=(
                        f"Session momentum: '{session_summary.get('momentum', 'cold_start')}'. "
                        f"Session clarity: {session_summary.get('clarity', 50.0)}/100. "
                        f"Experience: '{profile_summary.get('experience_level', 'beginner')}'. "
                        f"Missing layers: {missing or 'none'}."
                    ),
                    output_summary=(
                        f"Context assembled in {timing_info.get('total_ms', '?')}ms. "
                        f"Active concepts: {session_summary.get('active_concepts', [])}."
                    ),
                )
            else:
                # Legacy trace
                profile = user_context.get("profile", {})
                struggles = user_context.get("struggles", [])
                eval_history = user_context.get("progress", {}).get("evaluation_history", [])
                last_clarity = eval_history[-1].get("clarity_score", None) if eval_history else None

                await trace_service.add_trace(
                    request_id=request_id,
                    agent="Memory",
                    action="Context Fetched (legacy)",
                    details={"profile": "Loaded", "fallback": True},
                    user_id=user_id,
                    session_id=chat_id,
                    input_summary=f"Legacy context fetch for user '{user_id}'.",
                    decision="Fell back to flat UserMemory due to v2 service failure.",
                    reasoning=(
                        f"User has {len(struggles)} struggle(s). "
                        f"Last clarity: {last_clarity if last_clarity is not None else 'N/A'}."
                    ),
                    output_summary=(
                        f"Legacy context — stage: '{profile.get('stage', 'unknown')}', "
                        f"pace: '{profile.get('learning_pace', 'moderate')}'."
                    ),
                )

            # Check message count for first-message detection
            msg_count = await chat_service.get_message_count(chat_id)
            is_first_message = msg_count <= 1

            # ========== STEP 4: PLANNER (STRATEGY) ==========
            t0 = time.monotonic()
            if use_v2:
                strategy = await self.planner_agent.plan_response_v2(user_context, message)
            else:
                strategy = self.planner_agent.plan_response(user_context, message)
            step_timings["4_planner"] = _elapsed(t0)

            # Build trace reasoning
            if use_v2:
                session_info = user_context.get("session", {})
                override_info = strategy.get("_override_applied", "none")

                await trace_service.add_trace(
                    request_id=request_id,
                    agent="Planner",
                    action="Strategy Decided (v2)",
                    details={
                        "strategy": strategy.get("strategy"),
                        "tone": strategy.get("tone"),
                        "pacing": strategy.get("pacing"),
                        "focus_concepts": strategy.get("focus_concepts", []),
                        "should_assess": strategy.get("should_assess"),
                        "goal_inference": strategy.get("session_goal_inference"),
                        "override": override_info,
                    },
                    user_id=user_id,
                    session_id=chat_id,
                    input_summary=(
                        f"Message: \"{message[:120]}{'...' if len(message) > 120 else ''}\". "
                        f"Momentum='{session_info.get('momentum', 'cold_start')}', "
                        f"clarity={session_info.get('clarity', 50.0)}/100."
                    ),
                    decision=(
                        f"strategy='{strategy.get('strategy')}', "
                        f"tone='{strategy.get('tone')}', "
                        f"pacing='{strategy.get('pacing')}', "
                        f"focus_concepts={strategy.get('focus_concepts', [])}."
                    ),
                    reasoning=(
                        f"Override: {override_info}. "
                        f"Detected emotion: '{strategy.get('detected_emotion', 'neutral')}'. "
                        f"Goal inference: '{strategy.get('session_goal_inference') or 'none'}'."
                    ),
                    output_summary=(
                        f"Plan: '{strategy.get('strategy')}' strategy, "
                        f"'{strategy.get('tone')}' tone, "
                        f"max {strategy.get('max_lines', 6)} lines."
                    ),
                )
            else:
                # Legacy planner trace
                eval_history = user_context.get("progress", {}).get("evaluation_history", [])
                recent_clarity_val = eval_history[-1].get("clarity_score", 50) if eval_history else 50
                confusion_trend = eval_history[-1].get("confusion_trend", "stable") if eval_history else "stable"

                await trace_service.add_trace(
                    request_id=request_id,
                    agent="Planner",
                    action="Strategy Decided (legacy)",
                    details={
                        "strategy": strategy.get("strategy"),
                        "tone": strategy.get("tone"),
                        "pacing": strategy.get("pacing"),
                    },
                    user_id=user_id,
                    session_id=chat_id,
                    input_summary=f"Message: \"{message[:120]}\". Clarity={recent_clarity_val}/100.",
                    decision=f"strategy='{strategy.get('strategy')}', tone='{strategy.get('tone')}'.",
                    reasoning=f"Trend={confusion_trend}. Focus: {strategy.get('focus_areas', [])}.",
                    output_summary=f"Plan: '{strategy.get('strategy')}', max {strategy.get('max_lines', 6)} lines.",
                )

            # ========== STEP 5: EXECUTOR (GENERATE RESPONSE) ==========
            t0 = time.monotonic()
            response = self.executor_agent.generate_response(user_context, message, strategy)
            step_timings["5_executor"] = _elapsed(t0)

            response_line_count = len([ln for ln in response.split("\n") if ln.strip()])

            await trace_service.add_trace(
                request_id=request_id,
                agent="Executor",
                action="Response Generated",
                details={
                    "line_count": response_line_count,
                    "char_count": len(response),
                },
                user_id=user_id,
                session_id=chat_id,
                input_summary=(
                    f"Strategy: '{strategy.get('strategy')}', "
                    f"tone='{strategy.get('tone')}', "
                    f"verbosity='{strategy.get('verbosity')}'."
                ),
                decision=f"Generate '{strategy.get('verbosity', 'normal')}' response.",
                reasoning=f"Pacing='{strategy.get('pacing')}', emotion='{strategy.get('detected_emotion', 'neutral')}'.",
                output_summary=(
                    f"{response_line_count} lines, {len(response)} chars. "
                    f"Preview: \"{response[:100].replace(chr(10), ' ')}{'...' if len(response) > 100 else ''}\""
                ),
            )

            # ========== STEP 6: SAVE MENTOR RESPONSE IMMEDIATELY ==========
            t0 = time.monotonic()
            await chat_service.add_message(
                chat_id=chat_id,
                user_id=user_id,
                sender=MessageSender.MENTOR,
                content=response,
                metadata={"planner_strategy": strategy},
            )
            step_timings["6_save_response"] = _elapsed(t0)

            await trace_service.add_trace(
                request_id=request_id,
                agent="Persistence",
                action="Mentor Response Saved",
                details={"chat_id": chat_id, "sync": True},
                user_id=user_id,
                session_id=chat_id,
                input_summary=f"Executor response ({len(response)} chars) ready to persist.",
                decision="Write mentor response to chat collection synchronously.",
                reasoning="Response must be stored before returning to the client so history is consistent.",
                output_summary=f"Mentor message persisted to chat {chat_id}.",
            )

            # ========== STEP 7: INCREMENT SESSION MESSAGE COUNT (NEW) ==========
            if use_v2:
                t0 = time.monotonic()
                try:
                    await session_context_service.increment_message_count(
                        session_id=chat_id
                    )
                except Exception as e:
                    logger.warning("Failed to increment session message count: %s", e)
                step_timings["7_session_increment"] = _elapsed(t0)

            # ========== STEP 8: UPDATE CHAT TITLE (first message only) ==========
            if is_first_message:
                chat_intent = strategy.get("chat_intent", "")
                chat_title = self._generate_chat_title(message, chat_intent)
                await chat_service.update_chat_title(chat_id, chat_title)

            # ========== STEP 9: PREPARE RESULT ==========
            evaluation_data = None
            session_context_data = None

            if use_v2:
                # Use session clarity from the assembled context
                session_info = user_context.get("session", {})
                evaluation_data = {
                    "clarity_score": session_info.get("clarity", 50.0),
                    "understanding_delta": 0,
                    "confusion_trend": "stable",
                    "engagement_level": "medium",
                }
                # Session context snapshot for the frontend
                session_context_data = {
                    "goal": session_info.get("goal"),
                    "momentum": session_info.get("momentum", "cold_start"),
                    "active_concepts": session_info.get("active_concepts", []),
                    "message_count": session_info.get("message_count", 0),
                }
            else:
                prev_evaluations = user_context.get("progress", {}).get("evaluation_history", [])
                if prev_evaluations:
                    latest_eval = prev_evaluations[-1]
                    evaluation_data = {
                        "clarity_score": latest_eval.get("clarity_score", 0),
                        "understanding_delta": latest_eval.get("understanding_delta", 0),
                        "confusion_trend": latest_eval.get("confusion_trend", "stable"),
                        "engagement_level": latest_eval.get("engagement_level", "medium"),
                    }

            result = {
                "response": response,
                "chat_id": chat_id,
                "evaluation": evaluation_data,
                "session_context": session_context_data,  # None when v2 unavailable
            }

            # ========== STEP 10: ASYNC BACKGROUND TASKS ==========
            step_timings["total_sync_ms"] = round((time.monotonic() - pipeline_start) * 1000, 1)
            logger.info(
                "Pipeline sync complete [%s]: %s", request_id, step_timings
            )

            if use_v2:
                asyncio.create_task(self._run_background_tasks_v2(
                    user_id=user_id,
                    message=message,
                    response=response,
                    user_context=user_context,
                    strategy=strategy,
                    request_id=request_id,
                    chat_id=chat_id,
                ))
            else:
                asyncio.create_task(self._run_background_tasks(
                    user_id=user_id,
                    message=message,
                    response=response,
                    user_context=user_context,
                    strategy=strategy,
                    request_id=request_id,
                    chat_id=chat_id,
                ))

            return result

        except Exception as e:
            logger.error("Orchestrator error: %s", e, exc_info=True)
            return {
                "response": "I sense something stirred in our conversation. Let's pause for a moment — share with me what you were thinking, and we'll find our way together.",
                "chat_id": chat_id,
            }

    # =========================================================================
    # NEW: Background tasks using three-layer memory
    # =========================================================================

    async def _run_background_tasks_v2(
        self,
        user_id: str,
        message: str,
        response: str,
        user_context: Dict,
        strategy: Dict,
        request_id: str,
        chat_id: Optional[str] = None,
    ):
        """
        Phase 4.7 background tasks — session-scoped evaluation and memory updates.

        Runs after the response is returned to the user. Failures here are
        non-critical and logged but never propagated.

        session_id == chat_id (see module docstring).
        """
        try:
            session = user_context.get("session", {})

            # ── Struggle detection (unchanged) ─────────────────────────────
            struggle_check = self.evaluator_agent.detect_struggle(message)
            if struggle_check.get("is_struggle") and struggle_check.get("topic"):
                # Write to legacy memory (evaluator reads from it)
                await self.memory_agent.update_struggle(
                    user_id,
                    struggle_check["topic"],
                    struggle_check.get("severity", "mild"),
                )
                await trace_service.add_trace(
                    request_id=request_id,
                    agent="Evaluator",
                    action="Struggle Detected",
                    details=struggle_check,
                    user_id=user_id,
                    session_id=chat_id,
                    input_summary=f"Scanned for struggle: \"{message[:120]}\".",
                    decision=f"Flagged: '{struggle_check.get('topic')}'.",
                    reasoning=f"Severity: '{struggle_check.get('severity', 'mild')}'.",
                    output_summary=f"Struggle logged: '{struggle_check.get('topic')}'.",
                )

            # ── Planner-driven legacy memory updates ───────────────────────
            memory_update = strategy.get("memory_update", {})
            if memory_update.get("new_interest"):
                interests = user_context.get("profile", {}).get("career_interests", [])
                new_interest = memory_update["new_interest"]
                if new_interest not in interests:
                    # Legacy write
                    await self.memory_agent.update_profile(user_id, interests=interests + [new_interest])

            if memory_update.get("new_goal"):
                goals = user_context.get("profile", {}).get("career_interests", [])
                new_goal = memory_update["new_goal"]
                if new_goal not in goals:
                    await self.memory_agent.update_profile(user_id, goals=[new_goal])

            # ── Session-scoped evaluation (NEW) ────────────────────────────
            t0 = time.monotonic()
            evaluation = await self.evaluator_agent.evaluate_interaction_v2(
                user_id, message, response, user_context
            )
            eval_ms = round((time.monotonic() - t0) * 1000, 1)

            new_clarity = evaluation.get("clarity_score", 50)
            prev_clarity = session.get("clarity", 50.0)
            delta = evaluation.get("understanding_delta", 0)
            trend = evaluation.get("confusion_trend", "stable")
            concepts_found = evaluation.get("concepts_discussed", [])

            if new_clarity > prev_clarity:
                clarity_movement = f"increased {prev_clarity}→{new_clarity}"
            elif new_clarity < prev_clarity:
                clarity_movement = f"decreased {prev_clarity}→{new_clarity}"
            else:
                clarity_movement = f"unchanged at {new_clarity}"

            await trace_service.add_trace(
                request_id=request_id,
                agent="Evaluator",
                action="Interaction Scored (v2)",
                details={
                    "clarity_score": new_clarity,
                    "delta": delta,
                    "trend": trend,
                    "concepts_extracted": concepts_found,
                    "eval_ms": eval_ms,
                },
                user_id=user_id,
                session_id=chat_id,
                input_summary=f"Evaluated message+response. Prev clarity: {prev_clarity}/100.",
                decision=f"clarity={new_clarity}/100, delta={delta:+d}, trend='{trend}'.",
                reasoning=(
                    f"{evaluation.get('reasoning', '')} "
                    f"Concepts: {concepts_found or 'none'}. "
                    f"Misconceptions: {evaluation.get('misconceptions_detected', {})}."
                ),
                output_summary=f"Clarity {clarity_movement}. Concepts: {len(concepts_found)}.",
            )

            # ── Write to session + concept memory (NEW) ────────────────────
            t0 = time.monotonic()
            session_domain = session.get("domain")
            await self.evaluator_agent.update_memory_from_evaluation_v2(
                user_id=user_id,
                session_id=chat_id,
                session_domain=session_domain,
                evaluation=evaluation,
            )
            v2_write_ms = round((time.monotonic() - t0) * 1000, 1)

            # ── Write to legacy memory too (backward compat) ───────────────
            t0 = time.monotonic()
            await self.evaluator_agent.update_memory_from_evaluation(user_id, evaluation)
            await self.memory_agent.store_evaluation_result(user_id, evaluation)
            await self.memory_agent.update_effort_metrics(user_id, session_occurred=True)
            legacy_write_ms = round((time.monotonic() - t0) * 1000, 1)

            await trace_service.add_trace(
                request_id=request_id,
                agent="Memory",
                action="Three-Layer Update Complete",
                details={
                    "v2_write_ms": v2_write_ms,
                    "legacy_write_ms": legacy_write_ms,
                    "concepts_updated": len(concepts_found),
                },
                user_id=user_id,
                session_id=chat_id,
                input_summary="Dispatched evaluation to session, concept, and legacy memory.",
                decision="Write to all three layers + legacy for backward compatibility.",
                reasoning=f"v2 writes: {v2_write_ms}ms, legacy writes: {legacy_write_ms}ms.",
                output_summary=f"Memory updated across all layers. Concepts: {len(concepts_found)}.",
            )

            # ── Three-layer memory update via MemoryAgent facade ───────────
            # This handles: session clarity, concept mastery, profile strengths/weaknesses
            await self.memory_agent.update_memory(
                user_id=user_id,
                session_id=chat_id,
                evaluation_result=evaluation,
            )

            # ── Periodic learner-trait refresh (legacy) ────────────────────
            if session.get("message_count", 0) % 10 == 0 and session.get("message_count", 0) > 0:
                await self.memory_agent.update_learner_traits(user_id)

        except Exception as e:
            logger.warning("Background task v2 error (non-critical): %s", e, exc_info=True)

    # =========================================================================
    # LEGACY: Original background tasks (used when v2 services fail)
    # =========================================================================

    async def _run_background_tasks(
        self,
        user_id: str,
        message: str,
        response: str,
        user_context: Dict,
        strategy: Dict,
        request_id: str,
        chat_id: Optional[str] = None,
    ):
        """
        LEGACY: Background tasks using flat UserMemory.
        Used as fallback when three-layer services are unavailable.
        """
        try:
            # ── Struggle detection ──────────────────────────────────────────
            struggle_check = self.evaluator_agent.detect_struggle(message)
            if struggle_check.get("is_struggle") and struggle_check.get("topic"):
                await self.memory_agent.update_struggle(
                    user_id,
                    struggle_check["topic"],
                    struggle_check.get("severity", "mild"),
                )
                await trace_service.add_trace(
                    request_id=request_id,
                    agent="Evaluator",
                    action="Struggle Detected",
                    details=struggle_check,
                    user_id=user_id,
                    session_id=chat_id,
                    input_summary=f"Scanned: \"{message[:120]}\".",
                    decision=f"Flagged: '{struggle_check.get('topic')}'.",
                    reasoning=f"Severity: '{struggle_check.get('severity', 'mild')}'.",
                    output_summary=f"Struggle logged: '{struggle_check.get('topic')}'.",
                )

            # ── Planner-driven memory updates ───────────────────────────────
            memory_update = strategy.get("memory_update", {})
            if memory_update.get("new_interest"):
                interests = user_context.get("profile", {}).get("interests", [])
                new_interest = memory_update["new_interest"]
                if new_interest not in interests:
                    interests.append(new_interest)
                    await self.memory_agent.update_profile(user_id, interests=interests)

            if memory_update.get("new_goal"):
                goals = user_context.get("profile", {}).get("goals", [])
                new_goal = memory_update["new_goal"]
                if new_goal not in goals:
                    goals.append(new_goal)
                    await self.memory_agent.update_profile(user_id, goals=goals)

            # ── Full interaction evaluation ─────────────────────────────────
            evaluation = self.evaluator_agent.evaluate_interaction(message, response, user_context)

            prev_evaluations = user_context.get("progress", {}).get("evaluation_history", [])
            prev_clarity = prev_evaluations[-1].get("clarity_score", 50) if prev_evaluations else 50
            new_clarity = evaluation.get("clarity_score", 50)

            if new_clarity > prev_clarity:
                clarity_movement = f"increased {prev_clarity}→{new_clarity}"
            elif new_clarity < prev_clarity:
                clarity_movement = f"decreased {prev_clarity}→{new_clarity}"
            else:
                clarity_movement = f"unchanged at {new_clarity}"

            await trace_service.add_trace(
                request_id=request_id,
                agent="Evaluator",
                action="Interaction Scored (legacy)",
                details={"clarity_score": new_clarity},
                user_id=user_id,
                session_id=chat_id,
                input_summary=f"Prev clarity: {prev_clarity}/100.",
                decision=f"clarity={new_clarity}/100.",
                reasoning=evaluation.get("reasoning", ""),
                output_summary=f"Clarity {clarity_movement}.",
            )

            await self.evaluator_agent.update_memory_from_evaluation(user_id, evaluation)
            await self.memory_agent.store_evaluation_result(user_id, evaluation)
            await self.memory_agent.update_effort_metrics(user_id, session_occurred=True)

            if user_context.get("progress", {}).get("total_interactions", 0) % 5 == 0:
                await self.memory_agent.update_learner_traits(user_id)

        except Exception as e:
            logger.warning("Background task error (non-critical): %s", e)

    # =========================================================================
    # Helpers
    # =========================================================================

    def _generate_chat_title(self, first_message: str, chat_intent: str) -> str:
        """
        Generate a human-readable title for the chat.
        Uses chat_intent from planner if available, otherwise extracts from message.
        """
        if chat_intent:
            return chat_intent.title()

        words = first_message.split()[:6]
        title = " ".join(words)
        if len(first_message.split()) > 6:
            title += "..."
        return title if title else "New Conversation"

    def process_message(
        self, user_id: str, message: str, chat_id: Optional[str] = None
    ) -> str:
        """Sync wrapper for backward compatibility."""
        import asyncio as _asyncio

        try:
            loop = _asyncio.get_event_loop()
        except RuntimeError:
            loop = _asyncio.new_event_loop()
            _asyncio.set_event_loop(loop)

        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    _asyncio.run,
                    self.process_message_async(user_id, message, chat_id),
                )
                result = future.result()
                return result.get("response", "")
        else:
            result = loop.run_until_complete(
                self.process_message_async(user_id, message, chat_id)
            )
            return result.get("response", "")


def _elapsed(t0: float) -> float:
    """Milliseconds since t0."""
    return round((time.monotonic() - t0) * 1000, 1)


# Singleton instance — imported by routes and WebSocket handlers
agent_orchestrator = AgentOrchestrator()
