"""
Agent Orchestrator
Coordinates all agents to process user messages and manage sessions.
Uses ChatService for message storage and context management.

CRITICAL: Messages are saved synchronously BEFORE returning response.
Evaluator and memory updates run asynchronously to not block the user.
"""
import asyncio
import uuid
from typing import Dict, Any, Optional

from app.agents.memory_agent import MemoryAgent
from app.agents.planner_agent import PlannerAgent
from app.agents.executor_agent import ExecutorAgent
from app.agents.evaluator_agent import EvaluatorAgent
from app.services.chat_service import chat_service
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
        chat_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Async version of message processing.
        """
        request_id = uuid.uuid4().hex[:8]

        # Get or create chat session
        if not chat_id:
            chat_id = await chat_service.get_or_create_active_chat(user_id)

        try:
            # ========== STEP 1: SAVE USER MESSAGE IMMEDIATELY ==========
            await chat_service.add_message(
                chat_id=chat_id,
                user_id=user_id,
                sender=MessageSender.USER,
                content=message
            )
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

            # ========== STEP 2: GET CONTEXT (MEMORY AGENT) ==========
            user_context = await self.memory_agent.get_user_context(user_id)
            recent_context = await chat_service.format_context_for_llm(chat_id, n=5)
            user_context["recent_chat"] = recent_context

            # Summarise what memory returned for the trace
            profile = user_context.get("profile", {})
            struggles = user_context.get("struggles", [])
            eval_history = user_context.get("progress", {}).get("evaluation_history", [])
            last_clarity = eval_history[-1].get("clarity_score", None) if eval_history else None
            chat_lines = len(recent_context.split("\n")) if recent_context else 0

            await trace_service.add_trace(
                request_id=request_id,
                agent="Memory",
                action="Context Fetched",
                details={"profile": "Loaded", "chat_history": chat_lines},
                user_id=user_id,
                session_id=chat_id,
                input_summary=(
                    f"Request: retrieve full user context for user '{user_id}'. "
                    f"Last 5 chat turns also fetched."
                ),
                decision="Assemble profile, struggles, progress, and recent chat into a single context dict.",
                reasoning=(
                    f"User has {len(struggles)} known struggle(s). "
                    f"Last clarity score: {last_clarity if last_clarity is not None else 'N/A'}. "
                    f"Fetched {chat_lines} lines of recent chat history as LLM context."
                ),
                output_summary=(
                    f"Context assembled — stage: '{profile.get('stage', 'unknown')}', "
                    f"interests: {profile.get('interests', [])}, "
                    f"pace: '{profile.get('learning_pace', 'moderate')}'."
                ),
            )

            # Check message count to determine if this is first message
            msg_count = await chat_service.get_message_count(chat_id)
            is_first_message = msg_count <= 1

            # ========== STEP 3: PLANNER (STRATEGY) ==========
            strategy = self.planner_agent.plan_response(user_context, message)

            # Build human-readable reasoning from planner inputs
            recent_clarity_val = (
                eval_history[-1].get("clarity_score", 50) if eval_history else 50
            )
            confusion_trend = (
                eval_history[-1].get("confusion_trend", "stable") if eval_history else "stable"
            )
            if recent_clarity_val < 40:
                strategy_hint = f"Clarity low ({recent_clarity_val}/100) → supportive, slower pace."
            elif recent_clarity_val >= 70:
                strategy_hint = f"Clarity high ({recent_clarity_val}/100) → can challenge more."
            elif confusion_trend == "worsening":
                strategy_hint = f"Clarity declining (trend={confusion_trend}) → slow down, check gaps."
            else:
                strategy_hint = f"Moderate clarity ({recent_clarity_val}/100, trend={confusion_trend}) → maintain pace."

            await trace_service.add_trace(
                request_id=request_id,
                agent="Planner",
                action="Strategy Decided",
                details={
                    "strategy": strategy.get("strategy"),
                    "tone": strategy.get("tone"),
                    "intent": strategy.get("chat_intent"),
                    "verbosity": strategy.get("verbosity"),
                    "pacing": strategy.get("pacing"),
                    "detected_emotion": strategy.get("detected_emotion"),
                },
                user_id=user_id,
                session_id=chat_id,
                input_summary=(
                    f"User message: \"{message[:120]}{'...' if len(message) > 120 else ''}\". "
                    f"Clarity={recent_clarity_val}/100, trend={confusion_trend}, "
                    f"stage='{profile.get('stage', 'unknown')}', "
                    f"struggles={[s.get('topic') for s in struggles[:3]]}."
                ),
                decision=(
                    f"strategy='{strategy.get('strategy')}', "
                    f"tone='{strategy.get('tone')}', "
                    f"verbosity='{strategy.get('verbosity')}', "
                    f"pacing='{strategy.get('pacing')}', "
                    f"ask_question={strategy.get('should_ask_question')}."
                ),
                reasoning=(
                    f"{strategy_hint} "
                    f"Detected emotion: '{strategy.get('detected_emotion', 'neutral')}'. "
                    f"Focus areas: {strategy.get('focus_areas', [])}. "
                    f"Chat intent: '{strategy.get('chat_intent', '')}'."
                ),
                output_summary=(
                    f"Plan: respond with '{strategy.get('strategy')}' strategy, "
                    f"'{strategy.get('tone')}' tone, "
                    f"max {strategy.get('max_lines', 6)} lines."
                ),
            )

            # ========== STEP 4: EXECUTOR (GENERATE RESPONSE) ==========
            response = self.executor_agent.generate_response(user_context, message, strategy)

            response_lines = response.split("\n")
            response_line_count = len([line for line in response_lines if line.strip()])

            await trace_service.add_trace(
                request_id=request_id,
                agent="Executor",
                action="Response Generated",
                details={
                    "line_count": response_line_count,
                    "style": "brief" if strategy.get("verbosity") == "brief" else "standard",
                    "char_count": len(response),
                },
                user_id=user_id,
                session_id=chat_id,
                input_summary=(
                    f"User context + planner strategy "
                    f"(strategy='{strategy.get('strategy')}', "
                    f"tone='{strategy.get('tone')}', "
                    f"verbosity='{strategy.get('verbosity')}', "
                    f"max_lines={strategy.get('max_lines', 6)})."
                ),
                decision=(
                    f"Generate a '{strategy.get('verbosity', 'normal')}' "
                    f"mentor response using '{strategy.get('strategy')}' approach."
                ),
                reasoning=(
                    f"Planner requested '{strategy.get('strategy')}' strategy with "
                    f"'{strategy.get('tone')}' tone. "
                    f"Pacing is '{strategy.get('pacing')}'; "
                    f"ask_question={strategy.get('should_ask_question')}. "
                    f"User emotion detected as '{strategy.get('detected_emotion', 'neutral')}'."
                ),
                output_summary=(
                    f"Response produced: {response_line_count} non-empty line(s), "
                    f"{len(response)} chars. "
                    f"Preview: \"{response[:100].replace(chr(10), ' ')}{'...' if len(response) > 100 else ''}\""
                ),
            )

            # ========== STEP 5: SAVE MENTOR RESPONSE IMMEDIATELY ==========
            await chat_service.add_message(
                chat_id=chat_id,
                user_id=user_id,
                sender=MessageSender.MENTOR,
                content=response,
                metadata={"planner_strategy": strategy}
            )
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

            # ========== STEP 6: UPDATE CHAT TITLE (first message only) ==========
            if is_first_message:
                chat_intent = strategy.get("chat_intent", "")
                chat_title = self._generate_chat_title(message, chat_intent)
                await chat_service.update_chat_title(chat_id, chat_title)

            # ========== STEP 7: PREPARE RESULT ==========
            # Fetch latest available evaluation from previous messages
            evaluation_data = None
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
                "evaluation": evaluation_data
            }

            # ========== STEP 8: ASYNC BACKGROUND TASKS ==========
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
                "chat_id": chat_id
            }

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
        Run evaluator and memory updates asynchronously (fire-and-forget).
        All traces here include rich observability fields.
        """
        try:
            # ── Struggle detection ──────────────────────────────────────────
            struggle_check = self.evaluator_agent.detect_struggle(message)
            if struggle_check.get("is_struggle") and struggle_check.get("topic"):
                await self.memory_agent.update_struggle(
                    user_id,
                    struggle_check["topic"],
                    struggle_check.get("severity", "mild")
                )
                await trace_service.add_trace(
                    request_id=request_id,
                    agent="Evaluator",
                    action="Struggle Detected",
                    details=struggle_check,
                    user_id=user_id,
                    session_id=chat_id,
                    input_summary=f"User message scanned for struggle indicators: \"{message[:120]}\".",
                    decision=f"Flagged struggle on topic: '{struggle_check.get('topic')}'.",
                    reasoning=(
                        f"Message contained explicit struggle language. "
                        f"Severity assessed as '{struggle_check.get('severity', 'mild')}'. "
                        f"Topic: '{struggle_check.get('topic')}'."
                    ),
                    output_summary=(
                        f"Struggle logged to memory — topic='{struggle_check.get('topic')}', "
                        f"severity='{struggle_check.get('severity', 'mild')}'."
                    ),
                )

            # ── Planner-driven memory updates ───────────────────────────────
            memory_update = strategy.get("memory_update", {})
            if memory_update.get("new_interest"):
                interests = user_context.get("profile", {}).get("interests", [])
                new_interest = memory_update["new_interest"]
                if new_interest not in interests:
                    interests.append(new_interest)
                    await self.memory_agent.update_profile(user_id, interests=interests)
                    await trace_service.add_trace(
                        request_id=request_id,
                        agent="Memory",
                        action="Interest Recorded",
                        details={"new_interest": new_interest},
                        user_id=user_id,
                        session_id=chat_id,
                        input_summary="Planner detected a new interest in user message.",
                        decision=f"Add '{new_interest}' to user interest profile.",
                        reasoning=(
                            f"Planner flagged new_interest='{new_interest}' from message context. "
                            f"Not yet in user profile, appending."
                        ),
                        output_summary=f"User profile updated: interests now include '{new_interest}'.",
                    )

            if memory_update.get("new_goal"):
                goals = user_context.get("profile", {}).get("goals", [])
                new_goal = memory_update["new_goal"]
                if new_goal not in goals:
                    goals.append(new_goal)
                    await self.memory_agent.update_profile(user_id, goals=goals)
                    await trace_service.add_trace(
                        request_id=request_id,
                        agent="Memory",
                        action="Goal Recorded",
                        details={"new_goal": new_goal},
                        user_id=user_id,
                        session_id=chat_id,
                        input_summary="Planner detected a new goal in user message.",
                        decision=f"Add '{new_goal}' to user goals.",
                        reasoning=(
                            f"Planner flagged new_goal='{new_goal}' from message context. "
                            f"Not yet in user profile, appending."
                        ),
                        output_summary=f"User profile updated: goals now include '{new_goal}'.",
                    )

            # ── Full interaction evaluation ─────────────────────────────────
            evaluation = self.evaluator_agent.evaluate_interaction(message, response, user_context)

            prev_evaluations = user_context.get("progress", {}).get("evaluation_history", [])
            prev_clarity = prev_evaluations[-1].get("clarity_score", 50) if prev_evaluations else 50
            new_clarity = evaluation.get("clarity_score", 50)
            delta = evaluation.get("understanding_delta", 0)
            trend = evaluation.get("confusion_trend", "stable")

            # Determine direction label
            if new_clarity > prev_clarity:
                clarity_movement = f"increased {prev_clarity}→{new_clarity}"
            elif new_clarity < prev_clarity:
                clarity_movement = f"decreased {prev_clarity}→{new_clarity}"
            else:
                clarity_movement = f"unchanged at {new_clarity}"

            await trace_service.add_trace(
                request_id=request_id,
                agent="Evaluator",
                action="Interaction Scored",
                details={
                    "clarity_score": new_clarity,
                    "delta": delta,
                    "trend": trend,
                    "reason": evaluation.get("reasoning"),
                    "response_effectiveness": evaluation.get("response_effectiveness"),
                    "struggle_detected": evaluation.get("struggle_detected"),
                    "engagement_level": evaluation.get("engagement_level"),
                },
                user_id=user_id,
                session_id=chat_id,
                input_summary=(
                    f"User message: \"{message[:100]}\". "
                    f"Mentor response: \"{response[:100].replace(chr(10), ' ')}\". "
                    f"Previous clarity: {prev_clarity}/100."
                ),
                decision=(
                    f"clarity_score={new_clarity}/100, "
                    f"understanding_delta={delta:+d}, "
                    f"confusion_trend='{trend}', "
                    f"response_effectiveness='{evaluation.get('response_effectiveness', 'neutral')}'."
                ),
                reasoning=(
                    f"{evaluation.get('reasoning', 'No explicit reasoning provided.')} "
                    f"Engagement level: '{evaluation.get('engagement_level', 'medium')}'. "
                    f"Positive signals: {evaluation.get('positive_signals', [])}. "
                    f"Suggested next focus: '{evaluation.get('suggested_next_focus', 'N/A')}'."
                ),
                output_summary=(
                    f"Clarity {clarity_movement}. "
                    f"Struggle detected: {evaluation.get('struggle_detected') or 'none'}. "
                    f"Stagnation flags: {evaluation.get('stagnation_flags', [])}."
                ),
            )

            # Update memory from evaluation
            await self.evaluator_agent.update_memory_from_evaluation(user_id, evaluation)

            # Store evaluation snapshot for trend analysis
            await self.memory_agent.store_evaluation_result(user_id, evaluation)

            # ── Effort metrics ──────────────────────────────────────────────
            await self.memory_agent.update_effort_metrics(user_id, session_occurred=True)
            effort = user_context.get("progress", {}).get("effort_metrics", {})
            await trace_service.add_trace(
                request_id=request_id,
                agent="Memory",
                action="Effort Metrics Updated",
                details={"session": "Recorded"},
                user_id=user_id,
                session_id=chat_id,
                input_summary="Session completed; updating effort / consistency tracking.",
                decision="Increment session count and recalculate consistency streak.",
                reasoning=(
                    f"Each completed interaction is a session. "
                    f"Previous streak: {effort.get('consistency_streak', 0)} day(s), "
                    f"total sessions: {effort.get('total_sessions', 0)}."
                ),
                output_summary="Session count incremented; consistency streak recalculated.",
            )

            # ── Periodic learner-trait refresh ──────────────────────────────
            if user_context.get("progress", {}).get("total_interactions", 0) % 5 == 0:
                await self.memory_agent.update_learner_traits(user_id)

        except Exception as e:
            logger.warning("Background task error (non-critical): %s", e)

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

    def process_message(self, user_id: str, message: str, chat_id: Optional[str] = None) -> str:
        """
        Sync wrapper for backward compatibility.
        """
        import asyncio

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run,
                    self.process_message_async(user_id, message, chat_id)
                )
                result = future.result()
                return result.get("response", "")
        else:
            result = loop.run_until_complete(self.process_message_async(user_id, message, chat_id))
            return result.get("response", "")


# Singleton instance — imported by routes and WebSocket handlers
agent_orchestrator = AgentOrchestrator()
