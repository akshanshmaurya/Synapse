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
            # ========== STEP 1: SAVE USER MESSAGE IMMEDIATELY ==========
            await chat_service.add_message(
                chat_id=chat_id,
                user_id=user_id,
                sender=MessageSender.USER,
                content=message
            )
            # [TRACE] User Message
            await trace_service.add_trace(request_id, "Persistence", "User Message Saved", {
                "chat_id": chat_id, 
                "length": len(message)
            })
            
            # ========== STEP 2: GET CONTEXT (OPTIMIZED) ==========
            user_context = await self.memory_agent.get_user_context(user_id)
            recent_context = await chat_service.format_context_for_llm(chat_id, n=5)
            user_context["recent_chat"] = recent_context
            
            # [TRACE] Context Fetch
            await trace_service.add_trace(request_id, "Memory", "Context Fetched", {
                "profile": "Loaded",
                "chat_history": len(recent_context.split('\n')) if recent_context else 0
            })
            
            # Check message count to determine if this is first message
            msg_count = await chat_service.get_message_count(chat_id)
            is_first_message = msg_count <= 1
            
            # ========== STEP 3: PLANNER (includes chat_intent) ==========
            strategy = self.planner_agent.plan_response(user_context, message)
            
            # [TRACE] Planner
            await trace_service.add_trace(request_id, "Planner", "Strategy Implemented", {
                "strategy": strategy.get("strategy"),
                "tone": strategy.get("tone"),
                "intent": strategy.get("chat_intent"),
                "verbosity": strategy.get("verbosity")
            })
            
            # ========== STEP 4: EXECUTOR (generates response + title) ==========
            response = self.executor_agent.generate_response(user_context, message, strategy)
            
            # [TRACE] Executor
            await trace_service.add_trace(request_id, "Executor", "Response Generated", {
                "line_count": len(response.split('\n')),
                "style": "point-to-point" if strategy.get("verbosity") == "brief" else "standard"
            })
            
            # ========== STEP 5: SAVE MENTOR RESPONSE IMMEDIATELY ==========
            await chat_service.add_message(
                chat_id=chat_id,
                user_id=user_id,
                sender=MessageSender.MENTOR,
                content=response,
                metadata={"planner_strategy": strategy}
            )
            # [TRACE] Persistence
            await trace_service.add_trace(request_id, "Persistence", "Mentor Response Saved", {
                "chat_id": chat_id,
                "sync": True
            })
            
            # ========== STEP 6: UPDATE CHAT TITLE (first message only) ==========
            if is_first_message:
                chat_intent = strategy.get("chat_intent", "")
                chat_title = self._generate_chat_title(message, chat_intent)
                await chat_service.update_chat_title(chat_id, chat_title)
            
            # ========== STEP 7: PREPARE RESULT (return immediately after this) ==========
            result = {
                "response": response,
                "chat_id": chat_id
            }
            
            # ========== STEP 8: ASYNC BACKGROUND TASKS (don't block response) ==========
            # Fire and forget - user gets response immediately
            asyncio.create_task(self._run_background_tasks(
                user_id=user_id,
                message=message,
                response=response,
                user_context=user_context,
                strategy=strategy,
                request_id=request_id
            ))
            
            return result
            
        except Exception as e:
            print(f"Orchestrator error: {e}")
            import traceback
            traceback.print_exc()
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
        request_id: str
    ):
        """
        Run evaluator and memory updates asynchronously.
        """
        try:
            # Struggle detection
            struggle_check = self.evaluator_agent.detect_struggle(message)
            if struggle_check.get("is_struggle") and struggle_check.get("topic"):
                await self.memory_agent.update_struggle(
                    user_id,
                    struggle_check["topic"],
                    struggle_check.get("severity", "mild")
                )
                await trace_service.add_trace(request_id, "Evaluator", "Struggle Detected", struggle_check)
            
            # Memory updates from planner
            memory_update = strategy.get("memory_update", {})
            if memory_update.get("new_interest"):
                interests = user_context.get("profile", {}).get("interests", [])
                if memory_update["new_interest"] not in interests:
                    interests.append(memory_update["new_interest"])
                    await self.memory_agent.update_profile(user_id, interests=interests)
                    await trace_service.add_trace(request_id, "Memory", "Profile Updated", {"new_interest": memory_update["new_interest"]})
            
            if memory_update.get("new_goal"):
                goals = user_context.get("profile", {}).get("goals", [])
                if memory_update["new_goal"] not in goals:
                    goals.append(memory_update["new_goal"])
                    await self.memory_agent.update_profile(user_id, goals=goals)
                    await trace_service.add_trace(request_id, "Memory", "Profile Updated", {"new_goal": memory_update["new_goal"]})
            
            # Evaluate the interaction
            evaluation = self.evaluator_agent.evaluate_interaction(message, response, user_context)
            
            # [TRACE] Evaluator
            await trace_service.add_trace(request_id, "Evaluator", "Interaction Scored", {
                "clarity_score": evaluation.get("clarity_score"),
                "delta": evaluation.get("understanding_delta"),
                "trend": evaluation.get("confusion_trend")
            })
            
            # Update memory based on evaluation (insights only)
            await self.evaluator_agent.update_memory_from_evaluation(user_id, evaluation)
            
            # Store evaluation result for trend analysis
            await self.memory_agent.store_evaluation_result(user_id, evaluation)
            
            # Update effort metrics
            await self.memory_agent.update_effort_metrics(user_id, session_occurred=True)
            await trace_service.add_trace(request_id, "Memory", "Effort Metrics Saved", {
                "session": "Recorded",
                "timestamp": "ISO8601"
            })
            
            # Periodically update learner traits
            if user_context.get("progress", {}).get("total_interactions", 0) % 5 == 0:
                await self.memory_agent.update_learner_traits(user_id)
                
        except Exception as e:
            print(f"Background task error (non-critical): {e}")
    
    def _generate_chat_title(self, first_message: str, chat_intent: str) -> str:
        """
        Generate a human-readable title for the chat.
        Uses chat_intent from planner if available, otherwise extracts from message.
        """
        if chat_intent:
            # Convert intent to title case
            return chat_intent.title()
        
        # Fallback: extract from first message
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
