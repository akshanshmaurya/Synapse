"""
Agent Orchestrator
Coordinates all agents to process user messages and manage sessions.
"""
import uuid
from typing import Dict, Any, Optional

from app.agents.memory_agent import MemoryAgent
from app.agents.planner_agent import PlannerAgent
from app.agents.executor_agent import ExecutorAgent
from app.agents.evaluator_agent import EvaluatorAgent

class AgentOrchestrator:
    def __init__(self):
        self.memory_agent = MemoryAgent()
        self.planner_agent = PlannerAgent()
        self.executor_agent = ExecutorAgent()
        self.evaluator_agent = EvaluatorAgent()
        self.sessions: Dict[str, str] = {}  # user_id -> session_id
    
    def get_session_id(self, user_id: str) -> str:
        """Get or create a session ID for a user"""
        if user_id not in self.sessions:
            self.sessions[user_id] = str(uuid.uuid4())
        return self.sessions[user_id]
    
    async def process_message_async(self, user_id: str, message: str) -> str:
        """
        Async version of message processing.
        Coordinates all agents to generate a response.
        """
        session_id = self.get_session_id(user_id)
        
        try:
            # 1. Get user context from memory
            user_context = await self.memory_agent.get_user_context(user_id)
            
            # 2. Check for immediate struggles
            struggle_check = self.evaluator_agent.detect_struggle(message)
            if struggle_check.get("is_struggle") and struggle_check.get("topic"):
                await self.memory_agent.update_struggle(
                    user_id,
                    struggle_check["topic"],
                    struggle_check.get("severity", "mild")
                )
            
            # 3. Generate strategy with planner
            strategy = self.planner_agent.plan_response(user_context, message)
            
            # 4. Update memory if planner detected new info
            memory_update = strategy.get("memory_update", {})
            if memory_update.get("new_interest"):
                interests = user_context.get("profile", {}).get("interests", [])
                if memory_update["new_interest"] not in interests:
                    interests.append(memory_update["new_interest"])
                    await self.memory_agent.update_profile(user_id, interests=interests)
            
            if memory_update.get("new_goal"):
                goals = user_context.get("profile", {}).get("goals", [])
                if memory_update["new_goal"] not in goals:
                    goals.append(memory_update["new_goal"])
                    await self.memory_agent.update_profile(user_id, goals=goals)
            
            # 5. Generate response with executor
            response = self.executor_agent.generate_response(user_context, message, strategy)
            
            # 6. Evaluate the interaction
            evaluation = self.evaluator_agent.evaluate_interaction(message, response, user_context)
            
            # 7. Update memory based on evaluation
            await self.evaluator_agent.update_memory_from_evaluation(user_id, evaluation)
            
            # 8. Store the interaction
            await self.memory_agent.store_interaction(
                user_id=user_id,
                session_id=session_id,
                user_message=message,
                mentor_response=response,
                planner_strategy=strategy,
                evaluator_insights=evaluation
            )
            
            return response
            
        except Exception as e:
            print(f"Orchestrator error: {e}")
            return "I sense something stirred in our conversation. Let's pause for a moment — share with me what you were thinking, and we'll find our way together."
    
    def process_message(self, user_id: str, message: str) -> str:
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
            # We're already in an async context
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run, 
                    self.process_message_async(user_id, message)
                )
                return future.result()
        else:
            return loop.run_until_complete(self.process_message_async(user_id, message))
