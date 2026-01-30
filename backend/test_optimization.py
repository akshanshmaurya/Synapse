import asyncio
import os
from dotenv import load_dotenv
from app.agents.planner_agent import PlannerAgent
from app.agents.executor_agent import ExecutorAgent
from app.agents.memory_agent import MemoryAgent

load_dotenv()

async def test_agent_optimization():
    print("--- Starting Agent Optimization Test ---")
    
    # Mock user context
    user_context = {
        "profile": {"interactions": ["coding"], "goals": ["learn python"]},
        "struggles": [],
        "context_summary": "User is learning python.",
        "recent_interactions": []
    }
    
    message = "I'm feeling a bit overwhelmed with loops in Python. Can you help?"
    print(f"\nUser Message: \"{message}\"")
    
    # 1. Test Planner
    planner = PlannerAgent()
    print("\n[PLANNER] Generating strategy...")
    strategy = planner.plan_response(user_context, message)
    
    print(f"Strategy: {strategy.get('strategy')}")
    print(f"Verbosity: {strategy.get('verbosity')}")
    print(f"Max Lines: {strategy.get('max_lines')}")
    print(f"Voice Required: {strategy.get('voice_output_required')}")
    
    # 2. Test Executor
    executor = ExecutorAgent()
    print("\n[EXECUTOR] Generating response...")
    response = executor.generate_response(user_context, message, strategy)
    
    print("\n--- Response ---")
    print(response)
    print("----------------")
    
    line_count = len(response.split('\n'))
    print(f"\nResponse Line Count: {line_count}")
    
    if line_count <= strategy.get('max_lines', 8) + 2: # Allow small margin
        print("✅ PASSED: Response length within limits")
    else:
        print("❌ FAILED: Response too long")

if __name__ == "__main__":
    asyncio.run(test_agent_optimization())
