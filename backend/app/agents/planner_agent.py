"""
Planner Agent
Decides guidance strategy based on user context.
Outputs structured JSON decisions - no natural language.
"""
import google.generativeai as genai
import os
import json
from typing import Dict, Any, Optional

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class PlannerAgent:
    def __init__(self):
        self.model = genai.GenerativeModel("gemini-2.5-flash")
    
    def plan_response(self, user_context: Dict[str, Any], current_message: str) -> Dict[str, Any]:
        """
        Plan the response strategy based on user context.
        Uses evaluator history to inform tone and pacing decisions.
        Returns a structured strategy object (not user-facing).
        """
        # Access evaluation history for informed planning
        eval_history = user_context.get("progress", {}).get("evaluation_history", [])
        recent_clarity = eval_history[-1].get("clarity_score", 50) if eval_history else 50
        confusion_trend = eval_history[-1].get("confusion_trend", "stable") if eval_history else "stable"
        effort_metrics = user_context.get("progress", {}).get("effort_metrics", {})
        
        # Determine strategy hint based on understanding state
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
    "chat_intent": "short 3-5 word description of what this conversation is about, e.g. 'career roadmap discussion' or 'learning python basics'",
    "memory_update": {{
        "new_interest": null or "string",
        "new_goal": null or "string",
        "struggle_detected": null or "topic string"
    }}
}}

IMPORTANT: Adjust your strategy based on the clarity score. Do not push forward if clarity is low.
RESPOND ONLY WITH VALID JSON, NO OTHER TEXT."""

        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            
            # Clean up response if needed
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            
            return json.loads(text.strip())
        except json.JSONDecodeError as e:
            print(f"Planner JSON error: {e}")
            return self._default_strategy()
        except Exception as e:
            print(f"Planner Agent error: {e}")
            return self._default_strategy()
    
    def plan_roadmap_adjustment(
        self, 
        current_roadmap: Dict[str, Any],
        feedback: list
    ) -> Dict[str, Any]:
        """
        Plan adjustments to a roadmap based on user feedback.
        Returns a structured adjustment plan.
        """
        # Summarize feedback
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
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            
            return json.loads(text.strip())
        except Exception as e:
            print(f"Planner roadmap error: {e}")
            return {
                "action": "simplify",
                "reasoning": "Providing gentler steps based on feedback",
                "simplify_stages": [],
                "add_prerequisites": True,
                "recommended_focus": "foundational concepts",
                "encouragement_needed": True
            }
    
    def _default_strategy(self) -> Dict[str, Any]:
        """Return a safe default strategy"""
        return {
            "strategy": "support",
            "tone": "warm",
            "focus_areas": ["general guidance"],
            "should_ask_question": True,
            "detected_emotion": "neutral",
            "roadmap_relevant": False,
            "pacing": "normal",
            "chat_intent": "new conversation",
            "memory_update": {
                "new_interest": None,
                "new_goal": None,
                "struggle_detected": None
            }
        }
