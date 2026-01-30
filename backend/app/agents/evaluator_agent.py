"""
Evaluator Agent
Analyzes interactions to detect struggles and update strategy effectiveness.
Updates memory with insights including learning pace - no user-facing output.
"""
import google.generativeai as genai
import os
import json
from typing import Dict, Any, Optional
from datetime import datetime

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class EvaluatorAgent:
    def __init__(self):
        self.model = genai.GenerativeModel("gemini-2.5-flash")
    
    def evaluate_interaction(
        self, 
        user_message: str, 
        mentor_response: str,
        user_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze an interaction for insights.
        Returns evaluation results (not user-facing).
        """
        # Get previous evaluation for delta calculation
        prev_evaluations = user_context.get('progress', {}).get('evaluation_history', [])
        prev_clarity = prev_evaluations[-1].get('clarity_score', 50) if prev_evaluations else 50
        
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
- clarity_score: How well does the student understand the material? (0-100)
- confusion_trend: Is confusion improving, stable, or worsening?
- understanding_delta: Change in understanding (-10 to +10)
- stagnation_flags: Topics where NO progress is being made.

CORE PHILOSOPHY:
- Momentum comes from clarity improvement + independence, NOT just session count.
- Output signals and scores, NOT narratives.
- Be a strict judge of learning quality.

OUTPUT AS JSON:
{{
    "clarity_score": 0-100,
    "confusion_trend": "improving" or "stable" or "worsening",
    "understanding_delta": -10 to +10,
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
            print(f"Evaluator error: {e}")
            return self._default_evaluation()
    
    def analyze_roadmap_feedback(
        self,
        feedback_list: list,
        current_memory: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze accumulated roadmap feedback to determine adjustments.
        """
        if not feedback_list:
            return {"action": "none", "insights": []}
        
        feedback_summary = []
        stuck_count = 0
        unclear_count = 0
        needs_help_count = 0
        
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
            print(f"Roadmap feedback analysis error: {e}")
            return {
                "action": "regenerate" if stuck_count > 1 else "none",
                "new_learning_pace": "slow" if stuck_count > 2 else None,
                "difficulty_areas": [],
                "recommendations": [],
                "should_simplify": stuck_count > 1
            }
    
    def detect_struggle(self, message: str) -> Optional[Dict[str, Any]]:
        """
        Quick check for struggles in a user message.
        Used for real-time detection.
        """
        struggle_indicators = [
            "stuck", "confused", "don't understand", "hard", "difficult",
            "struggling", "lost", "overwhelmed", "can't", "help",
            "frustrated", "not sure", "unclear", "complicated"
        ]
        
        message_lower = message.lower()
        
        for indicator in struggle_indicators:
            if indicator in message_lower:
                # Use AI for deeper analysis
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
                    response = self.model.generate_content(prompt)
                    text = response.text.strip()
                    
                    if text.startswith("```json"):
                        text = text[7:]
                    if text.startswith("```"):
                        text = text[3:]
                    if text.endswith("```"):
                        text = text[:-3]
                    
                    return json.loads(text.strip())
                except:
                    return {"is_struggle": True, "topic": "general difficulty", "severity": "mild"}
        
        return {"is_struggle": False, "topic": None, "severity": None}
    
    async def update_memory_from_evaluation(
        self, 
        user_id: str, 
        evaluation: Dict[str, Any]
    ):
        """
        Update user memory based on evaluation insights.
        Includes learning pace adjustments.
        """
        from app.agents.memory_agent import MemoryAgent
        memory = MemoryAgent()
        
        # Update struggle if detected
        if evaluation.get("struggle_detected"):
            await memory.update_struggle(
                user_id,
                evaluation["struggle_detected"],
                evaluation.get("struggle_severity", "mild")
            )
        
        # Update learning pace if adjustment recommended
        if evaluation.get("pace_adjustment"):
            pace_map = {
                "slow_down": "slow",
                "speed_up": "fast",
                "maintain": None
            }
            new_pace = pace_map.get(evaluation["pace_adjustment"])
            if new_pace:
                await memory.update_profile(user_id, learning_pace=new_pace)
        
        # Update profile if new interest detected
        if evaluation.get("new_interest_detected"):
            context = await memory.get_user_context(user_id)
            interests = context.get("profile", {}).get("interests", [])
            new_interest = evaluation["new_interest_detected"]
            if new_interest not in interests:
                interests.append(new_interest)
                await memory.update_profile(user_id, interests=interests)
        
        # Update stage if recommended
        if evaluation.get("stage_change_recommended"):
            await memory.update_profile(
                user_id, 
                stage=evaluation["stage_change_recommended"]
            )
    
    async def update_memory_from_roadmap_feedback(
        self,
        user_id: str,
        analysis: Dict[str, Any]
    ):
        """
        Update memory based on roadmap feedback analysis.
        """
        from app.agents.memory_agent import MemoryAgent
        from app.db.mongodb import get_user_memory_collection
        
        memory = MemoryAgent()
        memory_collection = get_user_memory_collection()
        
        updates = {"updated_at": datetime.utcnow()}
        
        # Update learning pace
        if analysis.get("new_learning_pace"):
            updates["profile.learning_pace"] = analysis["new_learning_pace"]
        
        # Increment regeneration counter
        await memory_collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {"progress.roadmap_regeneration_count": 1},
                "$set": updates
            }
        )
        
        # Add difficulty areas as struggles
        for topic in analysis.get("difficulty_areas", []):
            await memory.update_struggle(user_id, topic, "moderate")
    
    def _default_evaluation(self) -> Dict[str, Any]:
        """Return default evaluation when analysis fails"""
        return {
            "clarity_score": 50,
            "confusion_trend": "stable",
            "understanding_delta": 0,
            "stagnation_flags": [],
            "engagement_level": "medium",
            "struggle_detected": None,
            "struggle_severity": None,
            "positive_signals": [],
            "response_effectiveness": "neutral",
            "suggested_next_focus": "continue current path",
            "new_interest_detected": None,
            "stage_change_recommended": None,
            "pace_adjustment": None
        }
